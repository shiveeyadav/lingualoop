// PostgreSQL pool (server-only). Created lazily so `next build` never needs a database.
import pg from 'pg';

// Return DATE columns as 'YYYY-MM-DD' strings (no timezone shifting) and
// COUNT/SUM bigint results as JS numbers (values here stay far below 2^53).
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

const g = globalThis;

export function getPool() {
  if (!g.__lingualoopPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    g.__lingualoopPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.PG_POOL_MAX || '10', 10),
      ssl: sslOption(),
    });
  }
  return g.__lingualoopPool;
}

export function sslOption() {
  const mode = (process.env.DATABASE_SSL || '').toLowerCase();
  if (mode === 'true' || mode === 'require') return { rejectUnauthorized: false };
  return undefined;
}

export function query(text, params) {
  return getPool().query(text, params);
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback errors
    }
    throw e;
  } finally {
    client.release();
  }
}
