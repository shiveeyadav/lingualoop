import { apiHandler } from '../../../lib/api';
import { loseHeart } from '../../../lib/progress';

export default apiHandler({
  POST: async ({ res, user }) => {
    const h = await loseHeart(user.id);
    return res.status(200).json({ hearts: h.hearts, heartsNextAt: h.nextAt });
  },
});
