import Link from 'next/link';
import Layout from '../components/Layout';
import { loadUser } from '../lib/ssr';
import { getLeaderboard } from '../lib/progress';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx, { required: true });
  if (!r.user) return r;
  const board = await getLeaderboard(r.user.id);
  return { props: { user: r.user, todayXp: r.todayXp, board } };
}

function fmt(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export default function Leaderboard({ user, todayXp, board }) {
  const listed = board.entries.some((e) => e.me);
  return (
    <Layout title="Weekly leaderboard" user={user} todayXp={todayXp}>
      <h1>Weekly leaderboard</h1>
      <p className="muted">
        XP earned since Monday {fmt(board.weekStart)} (UK time). Resets every Monday at midnight.
      </p>
      <div className="card">
        <p>
          <strong>Your XP this week: {board.myXp}</strong>
        </p>
        {user.isGuest ? (
          <p className="small">
            Guests are not shown on the leaderboard. <Link href="/signup">Create a profile</Link> to join.
          </p>
        ) : !user.showOnLeaderboard ? (
          <p className="small">
            You have hidden yourself from the leaderboard. <Link href="/settings">Change this in settings</Link>.
          </p>
        ) : !listed && board.myXp === 0 ? (
          <p className="small">Earn some XP this week to appear on the board.</p>
        ) : null}
      </div>
      {board.entries.length === 0 ? (
        <p>No one has earned XP yet this week. Be the first!</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <caption className="sr-only">Top learners this week</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Learner</th>
                <th scope="col">XP</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((e) => (
                <tr key={e.id} className={e.me ? 'me' : undefined}>
                  <td className="rank">{e.rank}</td>
                  <td>
                    {e.name}
                    {e.me ? ' (you)' : ''}
                  </td>
                  <td>{e.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
