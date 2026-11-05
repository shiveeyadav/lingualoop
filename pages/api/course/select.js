// Pick (enrol in) a course. Visitors without an account get a guest user so they
// can try a lesson straight away; signing up later keeps that progress.
import { apiHandler, HttpError } from '../../../lib/api';
import { query } from '../../../lib/db';
import { createSession, createGuestUser } from '../../../lib/auth';
import { getCourse } from '../../../lib/content';
import { rateLimit, clientIp } from '../../../lib/ratelimit';

export default apiHandler(
  {
    POST: async ({ req, res, user, body }) => {
      const course = typeof body.course === 'string' ? body.course : '';
      if (!getCourse(course)) throw new HttpError(400, 'Unknown course');
      let userId = user && user.id;
      if (!userId) {
        if (!rateLimit('guest:' + clientIp(req), 30, 60 * 60 * 1000)) {
          throw new HttpError(429, 'Too many new sessions from this network. Please sign up or try later.');
        }
        userId = await createGuestUser();
        await createSession(res, userId);
      }
      await query('INSERT INTO enrollments (user_id, course) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, course]);
      await query('UPDATE users SET current_course = $2, last_seen_at = NOW() WHERE id = $1', [userId, course]);
      return res.status(200).json({ ok: true, redirect: '/learn/' + course });
    },
  },
  { auth: 'optional' }
);
