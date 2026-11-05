import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { loadUser } from '../lib/ssr';
import { listCourses } from '../lib/content';
import { postJson } from '../lib/client';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx);
  return { props: { user: r.user, todayXp: r.todayXp, courses: listCourses() } };
}

export default function Courses({ user, todayXp, courses }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function choose(id) {
    setBusy(id);
    setError('');
    try {
      const r = await postJson('/api/course/select', { course: id });
      router.push(r.redirect || '/learn/' + id);
    } catch (e) {
      setError(e.message);
      setBusy(null);
    }
  }

  return (
    <Layout title="Choose a course" user={user} todayXp={todayXp}>
      <h1>I want to learn…</h1>
      {!user ? (
        <p className="muted">
          No account needed to start. Your progress is kept on this device, and you can save it later by creating a free
          profile.
        </p>
      ) : null}
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="course-grid">
        {courses.map((c) => {
          const current = user && user.currentCourse === c.id;
          return (
            <div className={'card course-card' + (current ? ' current' : '')} key={c.id}>
              <h2>{c.title}</h2>
              <p className="native" lang={c.speechLang}>
                {c.nativeName}
              </p>
              <p>{c.description}</p>
              <p className="muted small">
                {c.units} units · {c.skills} skills · {c.lessons} lessons · {c.exercises} exercises
              </p>
              <button type="button" className="btn btn-block" disabled={busy !== null} onClick={() => choose(c.id)}>
                {busy === c.id ? 'Opening…' : current ? 'Continue ' + c.shortName : 'Start ' + c.shortName}
              </button>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
