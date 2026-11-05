import { apiHandler, HttpError } from '../../../lib/api';
import { query } from '../../../lib/db';
import { cleanDisplayName } from '../../../lib/validate';
import { DAILY_GOALS } from '../../../lib/constants';

export default apiHandler({
  POST: async ({ res, user, body }) => {
    const sets = [];
    const params = [user.id];
    if (body.dailyGoal !== undefined) {
      if (!DAILY_GOALS.includes(body.dailyGoal)) throw new HttpError(400, 'Daily goal must be 10, 20, 30 or 50 XP');
      params.push(body.dailyGoal);
      sets.push('daily_goal = $' + params.length);
    }
    if (body.soundOn !== undefined) {
      if (typeof body.soundOn !== 'boolean') throw new HttpError(400, 'Invalid sound setting');
      params.push(body.soundOn);
      sets.push('sound_on = $' + params.length);
    }
    if (body.showOnLeaderboard !== undefined) {
      if (typeof body.showOnLeaderboard !== 'boolean') throw new HttpError(400, 'Invalid leaderboard setting');
      params.push(body.showOnLeaderboard);
      sets.push('show_on_leaderboard = $' + params.length);
    }
    if (body.displayName !== undefined) {
      if (user.is_guest) throw new HttpError(400, 'Create an account to set a display name');
      const name = cleanDisplayName(body.displayName);
      if (!name) throw new HttpError(400, 'Display name must be 1–30 characters');
      params.push(name);
      sets.push('display_name = $' + params.length);
    }
    if (!sets.length) throw new HttpError(400, 'Nothing to update');
    await query('UPDATE users SET ' + sets.join(', ') + ' WHERE id = $1', params);
    return res.status(200).json({ ok: true });
  },
});
