import { apiHandler, HttpError } from '../../../lib/api';
import { completeSession } from '../../../lib/progress';
import { rateLimit } from '../../../lib/ratelimit';

export default apiHandler({
  POST: async ({ res, user, body }) => {
    if (!rateLimit('complete:' + user.id, 6, 60 * 1000)) {
      throw new HttpError(429, 'Slow down a little and try again in a minute.');
    }
    const result = await completeSession(user.id, {
      course: body.course,
      mode: body.mode,
      lessonId: body.lessonId,
      items: body.items,
    });
    return res.status(200).json(result);
  },
});
