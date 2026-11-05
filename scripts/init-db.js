#!/usr/bin/env node
// Runs before the server starts (npm start / Docker CMD):
//   1. validates all course content (bad content stops the deploy),
//   2. waits for PostgreSQL, applies db/schema.sql (idempotent),
//   3. creates or promotes the admin from ADMIN_EMAIL / ADMIN_PASSWORD,
//   4. housekeeping: expired sessions and stale guest accounts.
const fs = require('fs');
const path = require('path');
const pg = require('pg');
const bcrypt = require('bcryptjs');
const { loadAllCourses, listCourses } = require('../lib/content');

function sslOption() {
  const mode = (process.env.DATABASE_SSL || '').toLowerCase();
  if (mode === 'true' || mode === 'require') return { rejectUnauthorized: false };
  return undefined;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectWithRetry(attempts) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: sslOption() });
    try {
      await client.connect();
      return client;
    } catch (e) {
      lastErr = e;
      try {
        await client.end();
      } catch (_) {
        // ignore
      }
      console.log('[init-db] database not ready (' + e.message + '), retry ' + i + '/' + attempts);
      await sleep(2000);
    }
  }
  throw lastErr;
}

async function ensureAdmin(client) {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) {
    console.log('[init-db] ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin account');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL is not a valid email');
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must be 8-72 bytes');
  }
  const { rows } = await client.query('SELECT id, role FROM users WHERE email = $1', [email]);
  if (!rows.length) {
    const hash = await bcrypt.hash(password, 11);
    await client.query(
      "INSERT INTO users (email, password_hash, display_name, role) VALUES ($1, $2, 'Admin', 'admin')",
      [email, hash]
    );
    console.log('[init-db] created admin ' + email);
    return;
  }
  if (rows[0].role !== 'admin') {
    await client.query("UPDATE users SET role = 'admin', is_guest = FALSE WHERE id = $1", [rows[0].id]);
    console.log('[init-db] promoted ' + email + ' to admin');
  }
  if (process.env.ADMIN_RESET_PASSWORD === 'true') {
    const hash = await bcrypt.hash(password, 11);
    await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [rows[0].id, hash]);
    await client.query('DELETE FROM sessions WHERE user_id = $1', [rows[0].id]);
    console.log('[init-db] admin password reset from ADMIN_PASSWORD');
  }
}

async function main() {
  loadAllCourses();
  listCourses().forEach((c) => {
    console.log('[init-db] content ok: ' + c.id + ' (' + c.units + ' units, ' + c.skills + ' skills, ' +
      c.lessons + ' lessons, ' + c.exercises + ' exercises)');
  });

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (process.env.NODE_ENV === 'production' && (process.env.SESSION_SECRET || '').length < 16) {
    throw new Error('SESSION_SECRET must be set (at least 16 characters)');
  }

  const client = await connectWithRetry(30);
  try {
    // Serialise concurrent starts (e.g. two replicas) with an advisory lock.
    await client.query('SELECT pg_advisory_lock(727274)');
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('[init-db] schema applied');
    await ensureAdmin(client);
    const s = await client.query('DELETE FROM sessions WHERE expires_at < NOW()');
    const g = await client.query(
      "DELETE FROM users WHERE is_guest = TRUE AND last_seen_at < NOW() - INTERVAL '30 days'"
    );
    console.log('[init-db] removed ' + s.rowCount + ' expired sessions, ' + g.rowCount + ' stale guests');
    await client.query('SELECT pg_advisory_unlock(727274)');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[init-db] FAILED:', e.message);
  process.exit(1);
});
