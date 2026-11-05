// UK GDPR right of access / portability: download all data held about the current user.
import { apiHandler } from '../../../lib/api';
import { query } from '../../../lib/db';

export default apiHandler({
  GET: async ({ res, user }) => {
    const id = user.id;
    const [u, enrollments, lessons, xp, words] = await Promise.all([
      query(
        `SELECT id, email, display_name, role, is_guest, xp_total, streak, longest_streak, last_active_date,
                daily_goal, sound_on, show_on_leaderboard, hearts, current_course, created_at, last_seen_at
         FROM users WHERE id = $1`,
        [id]
      ),
      query('SELECT course, started_at FROM enrollments WHERE user_id = $1 ORDER BY started_at', [id]),
      query('SELECT course, lesson_id, times, last_completed_at FROM lesson_completions WHERE user_id = $1 ORDER BY course, lesson_id', [id]),
      query('SELECT course, source, xp, day, created_at FROM xp_events WHERE user_id = $1 ORDER BY created_at', [id]),
      query('SELECT course, word, strength, correct, wrong, last_seen FROM word_strength WHERE user_id = $1 ORDER BY course, word', [id]),
    ]);
    const data = {
      exportedAt: new Date().toISOString(),
      note: 'Password hashes and session tokens are not included.',
      user: u.rows[0] || null,
      enrollments: enrollments.rows,
      lessonCompletions: lessons.rows,
      xpEvents: xp.rows,
      wordStrength: words.rows,
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lingualoop-data.json"');
    return res.status(200).send(JSON.stringify(data, null, 2));
  },
});
