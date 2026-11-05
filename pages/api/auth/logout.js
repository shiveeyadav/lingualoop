import { apiHandler } from '../../../lib/api';
import { destroySession } from '../../../lib/auth';

export default apiHandler(
  {
    POST: async ({ req, res }) => {
      await destroySession(req, res);
      return res.status(200).json({ ok: true });
    },
  },
  { auth: 'none' }
);
