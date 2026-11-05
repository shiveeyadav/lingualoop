// Server-side input validation helpers (pure).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmail(v) {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  if (e.length < 3 || e.length > 254 || !EMAIL_RE.test(e)) return null;
  return e;
}

// bcrypt only uses the first 72 bytes, so cap length to keep that honest.
export function checkPassword(v) {
  if (typeof v !== 'string') return 'Password is required';
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (Buffer.byteLength(v, 'utf8') > 72) return 'Password must be at most 72 bytes';
  return null;
}

export function cleanDisplayName(v) {
  if (typeof v !== 'string') return null;
  // Strip control characters and angle brackets, collapse whitespace.
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length < 1 || s.length > 30) return null;
  return s;
}

export function isInt(v, min, max) {
  return Number.isInteger(v) && v >= min && v <= max;
}
