import { apiHandler, HttpError } from '../../../lib/api';
import { query } from '../../../lib/db';
import { createSession, verifyPassword, destroySession } from '../../../lib/auth';
import { cleanEmail } from '../../../lib/validate';
import { rateLimit, clientIp } from '../../../lib/ratelimit';

export default apiHandler(
  {
    POST: async ({ req, res, body }) => {
      const email = cleanEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!email || !password || password.length > 200) throw new HttpError(400, 'Enter your email and password');
      if (!rateLimit('login:' + clientIp(req), 20, 15 * 60 * 1000) || !rateLimit('login:' + email, 10, 15 * 60 * 1000)) {
        throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
      }
      const { rows } = await query('SELECT id, password_hash FROM users WHERE email = $1 AND is_guest = FALSE', [email]);
      const user = rows[0];
      const ok = await verifyPassword(password, user ? user.password_hash : null);
      if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect');
      await destroySession(req, res); // drop any guest session on this browser
      await createSession(res, user.id);
      return res.status(200).json({ ok: true });
    },
  },
  { auth: 'none' }
);
