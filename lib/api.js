// Small wrapper for API routes: method check, same-origin check for mutations,
// optional auth, and uniform JSON errors (server-only).
import { getSessionUser } from './auth';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin form posts and non-browser clients
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  try {
    return new URL(origin).host === host;
  } catch (_) {
    return false;
  }
}

// handlers: { GET: fn, POST: fn }; options: { auth: 'none' | 'optional' | 'user' | 'admin' }
export function apiHandler(handlers, options = {}) {
  const auth = options.auth || 'user';
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const fn = handlers[req.method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(handlers).join(', '));
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (req.method !== 'GET' && !sameOrigin(req)) {
      return res.status(403).json({ error: 'Cross-origin request blocked' });
    }
    try {
      let user = null;
      if (auth !== 'none') {
        user = await getSessionUser(req);
        if (!user && (auth === 'user' || auth === 'admin')) throw new HttpError(401, 'Please log in');
        if (auth === 'admin' && (!user || user.role !== 'admin')) throw new HttpError(403, 'Admins only');
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      return await fn({ req, res, user, body });
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error('[api]', req.method, req.url, e);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
}
