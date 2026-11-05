import { apiHandler, HttpError } from '../../../lib/api';
import { query } from '../../../lib/db';
import { createSession, hashPassword, getSessionUser } from '../../../lib/auth';
import { cleanEmail, checkPassword, cleanDisplayName } from '../../../lib/validate';
import { rateLimit, clientIp } from '../../../lib/ratelimit';

export default apiHandler(
  {
    POST: async ({ req, res, body }) => {
      if (!rateLimit('signup:' + clientIp(req), 10, 60 * 60 * 1000)) {
        throw new HttpError(429, 'Too many sign-ups from this network. Try again later.');
      }
      const email = cleanEmail(body.email);
      if (!email) throw new HttpError(400, 'Please enter a valid email address');
      const pwError = checkPassword(body.password);
      if (pwError) throw new HttpError(400, pwError);
      const name = cleanDisplayName(body.displayName);
      if (!name) throw new HttpError(400, 'Display name must be 1–30 characters');
      if (body.acceptPrivacy !== true) throw new HttpError(400, 'Please accept the privacy notice');

      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length) throw new HttpError(409, 'An account with this email already exists. Try logging in.');

      const hash = await hashPassword(body.password);
      const current = await getSessionUser(req);
      let userId;
      try {
        if (current && current.is_guest) {
          // Keep the guest's progress by upgrading the same user row.
          const r = await query(
            `UPDATE users SET email = $2, password_hash = $3, display_name = $4, is_guest = FALSE
             WHERE id = $1 AND is_guest = TRUE RETURNING id`,
            [current.id, email, hash, name]
          );
          userId = r.rows[0] && r.rows[0].id;
          if (userId) await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
        }
        if (!userId) {
          const r = await query(
            'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
            [email, hash, name]
          );
          userId = r.rows[0].id;
        }
      } catch (e) {
        if (e && e.code === '23505') throw new HttpError(409, 'An account with this email already exists. Try logging in.');
        throw e;
      }
      await createSession(res, userId);
      return res.status(200).json({ ok: true });
    },
  },
  { auth: 'none' }
);
