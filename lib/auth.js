// Sessions + passwords (server-only).
// The cookie holds a random token; the database stores only an HMAC of it, keyed
// with SESSION_SECRET, so a leaked sessions table cannot be replayed as cookies.
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from './db';

export const COOKIE_NAME = 'll_session';
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 11;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set (at least 16 characters) in production');
  }
  return 'dev-only-insecure-session-secret';
}

function hashToken(token) {
  return crypto.createHmac('sha256', secret()).update(token).digest('hex');
}

function secureCookies() {
  if (process.env.COOKIE_SECURE === 'false') return false;
  if (process.env.COOKIE_SECURE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

function serializeCookie(value, maxAgeSeconds) {
  const parts = [
    COOKIE_NAME + '=' + value,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + maxAgeSeconds,
  ];
  if (secureCookies()) parts.push('Secure');
  return parts.join('; ');
}

function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', cookie);
  else res.setHeader('Set-Cookie', [].concat(prev, cookie));
}

export function parseCookies(req) {
  const out = {};
  const header = req.headers && req.headers.cookie;
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch (_) {
        out[k] = v;
      }
    }
  });
  return out;
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, BCRYPT_ROUNDS);
}

export async function verifyPassword(pw, hash) {
  if (!hash) {
    // Spend similar time when the account does not exist, then fail.
    await bcrypt.hash(pw, BCRYPT_ROUNDS);
    return false;
  }
  return bcrypt.compare(pw, hash);
}

export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, NOW() + make_interval(days => $3::int))',
    [hashToken(token), userId, SESSION_DAYS]
  );
  appendSetCookie(res, serializeCookie(token, maxAge));
}

export async function destroySession(req, res) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) await query('DELETE FROM sessions WHERE id = $1', [hashToken(token)]);
  appendSetCookie(res, serializeCookie('', 0));
}

export function clearSessionCookie(res) {
  appendSetCookie(res, serializeCookie('', 0));
}

const USER_COLUMNS = `u.id, u.email, u.display_name, u.role, u.is_guest, u.xp_total, u.streak,
  u.longest_streak, u.last_active_date, u.daily_goal, u.sound_on, u.show_on_leaderboard,
  u.hearts, u.hearts_updated_at, u.current_course, u.created_at`;

// Returns the raw user row for the current session, or null.
export async function getSessionUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token || token.length > 200) return null;
  const { rows } = await query(
    `SELECT ${USER_COLUMNS} FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

export async function getUserById(id) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [id]);
  return rows[0] || null;
}

export async function createGuestUser() {
  const { rows } = await query(
    "INSERT INTO users (is_guest, display_name) VALUES (TRUE, 'Guest') RETURNING id"
  );
  return rows[0].id;
}
