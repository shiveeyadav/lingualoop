import Layout from '../components/Layout';
import { loadUser } from '../lib/ssr';
import { getAdminStats } from '../lib/progress';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx, { admin: true });
  if (!r.user) return r;
  const stats = await getAdminStats();
  return { props: { user: r.user, todayXp: r.todayXp, stats } };
}

export default function Admin({ user, todayXp, stats }) {
  const t = stats.totals;
  return (
    <Layout title="Admin" user={user} todayXp={todayXp}>
      <h1>Admin</h1>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-box">
          Registered users<strong>{t.users}</strong>
        </div>
        <div className="stat-box">
          Guests<strong>{t.guests}</strong>
        </div>
        <div className="stat-box">
          Active today (UK)<strong>{t.activeToday}</strong>
        </div>
        <div className="stat-box">
          Active last 7 days<strong>{t.activeWeek}</strong>
        </div>
      </div>

      <h2>Courses</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Course</th>
              <th scope="col">Enrolled</th>
              <th scope="col">Learners</th>
              <th scope="col">Lesson completions</th>
              <th scope="col">Total XP</th>
              <th scope="col">Lessons</th>
              <th scope="col">Most completed</th>
            </tr>
          </thead>
          <tbody>
            {stats.perCourse.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td>{c.enrollments}</td>
                <td>{c.learners}</td>
                <td>{c.completions}</td>
                <td>{c.xp}</td>
                <td>{c.lessons}</td>
                <td>{c.topLessons.map((l) => l.lessonId + ' (' + l.n + ')').join(', ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Users ({stats.users.length} most recent)</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">XP</th>
              <th scope="col">Streak</th>
              <th scope="col">Last active</th>
              <th scope="col">Joined</th>
            </tr>
          </thead>
          <tbody>
            {stats.users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.xp}</td>
                <td>{u.streak}</td>
                <td>{u.lastActive || '-'}</td>
                <td>{u.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
