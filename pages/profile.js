import Link from 'next/link';
import Layout from '../components/Layout';
import { Icon } from '../components/Icons';
import { loadUser } from '../lib/ssr';
import { getProfileStats } from '../lib/progress';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx, { required: true });
  if (!r.user) return r;
  const stats = await getProfileStats(r.user.id);
  return { props: { user: r.user, todayXp: r.todayXp, stats } };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export default function Profile({ user, todayXp, stats }) {
  const max = Math.max(user.dailyGoal, ...stats.week.map((d) => d.xp));
  return (
    <Layout title="Profile" user={user} todayXp={todayXp}>
      <h1>{user.displayName}</h1>
      <p className="muted">
        {user.isGuest ? 'Guest learner' : 'Learning since ' + new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/London' })}
      </p>
      {user.isGuest ? (
        <p className="alert alert-info">
          Guest progress is only kept on this device. <Link href="/signup">Create a free profile</Link> to save it.
        </p>
      ) : null}

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-box">
          <span className="stat stat-streak">
            <Icon name="flame" /> Streak
          </span>
          <strong>{user.streak} days</strong>
        </div>
        <div className="stat-box">
          <span className="stat stat-streak">
            <Icon name="trophy" /> Longest
          </span>
          <strong>{user.longestStreak} days</strong>
        </div>
        <div className="stat-box">
          <span className="stat stat-xp">
            <Icon name="bolt" /> Total XP
          </span>
          <strong>{user.xpTotal}</strong>
        </div>
        <div className="stat-box">
          <span className="stat stat-xp">
            <Icon name="bolt" /> Today
          </span>
          <strong>
            {todayXp}/{user.dailyGoal}
          </strong>
        </div>
      </div>

      <section className="card" aria-labelledby="week-h">
        <h2 id="week-h">Last 7 days</h2>
        <div className="week-chart" aria-hidden="true">
          {stats.week.map((d) => (
            <div className="bar" key={d.day}>
              <span style={{ height: Math.round((d.xp / max) * 100) + '%' }} />
              {dayLabel(d.day)}
            </div>
          ))}
        </div>
        <ul className="sr-only">
          {stats.week.map((d) => (
            <li key={d.day}>
              {d.day}: {d.xp} XP
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="courses-h">
        <h2 id="courses-h">Courses</h2>
        {stats.courses.length === 0 ? (
          <p>
            No courses yet. <Link href="/courses">Pick one</Link>.
          </p>
        ) : null}
        <div className="course-grid">
          {stats.courses.map((c) => (
            <div className="card" key={c.id}>
              <h3>{c.title}</h3>
              <p>
                Lessons: {c.doneLessons} / {c.totalLessons}
                <br />
                <span className="crowns">
                  <Icon name="trophy" /> Units finished: {c.unitsDone} / {c.totalUnits}
                </span>
                <br />
                Words seen: {c.wordsLearned} · needing practice: {c.weakWords}
              </p>
              <div className="row">
                <Link href={'/learn/' + c.id} className="btn">
                  Learn
                </Link>
                <Link href={'/practice/' + c.id} className="btn btn-secondary">
                  Practise
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
