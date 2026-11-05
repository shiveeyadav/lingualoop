// Helpers for getServerSideProps (server-only).
import { getSessionUser } from './auth';
import { publicUser, getTodayXp } from './progress';

// Loads the session user. With { required: true } redirects anonymous visitors.
export async function loadUser(ctx, { required = false, admin = false, redirectTo = '/login' } = {}) {
  const row = await getSessionUser(ctx.req);
  if ((required || admin) && !row) {
    return { redirect: { destination: redirectTo, permanent: false } };
  }
  if (admin && row.role !== 'admin') {
    return { notFound: true };
  }
  if (!row) return { user: null, todayXp: 0 };
  const todayXp = await getTodayXp(row.id);
  return { user: publicUser(row), todayXp };
}
