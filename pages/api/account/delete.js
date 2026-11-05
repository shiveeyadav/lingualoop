// Permanently deletes the account and all learning data (UK GDPR right to erasure).
import { apiHandler, HttpError } from '../../../lib/api';
import { query } from '../../../lib/db';
import { verifyPassword, clearSessionCookie } from '../../../lib/auth';

export default apiHandler({
  POST: async ({ res, user, body }) => {
    if (body.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm');
    if (!user.is_guest) {
      const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
      const pw = typeof body.password === 'string' ? body.password : '';
      if (!pw || pw.length > 200 || !(await verifyPassword(pw, rows[0] && rows[0].password_hash))) {
        throw new HttpError(401, 'Password is incorrect');
      }
    }
    if (user.role === 'admin') {
      const admins = await query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
      if (admins.rows[0].n <= 1) throw new HttpError(400, 'You are the only admin. Promote another admin first.');
    }
    // ON DELETE CASCADE removes sessions, progress, XP and word data.
    await query('DELETE FROM users WHERE id = $1', [user.id]);
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  },
});
