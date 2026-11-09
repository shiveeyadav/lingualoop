import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { loadUser } from '../lib/ssr';
import { listCourses } from '../lib/content';
import { postJson } from '../lib/client';
import { query } from '../lib/db';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx);
  let enrolled = [];
  if (r.user) {
    const { rows } = await query('SELECT course FROM enrollments WHERE user_id = $1', [r.user.id]);
    enrolled = rows.map((row) => row.course);
  }
  return { props: { user: r.user, todayXp: r.todayXp, courses: listCourses(), enrolled } };
}

function scriptNote(c) {
  if (c.dir === 'rtl') return 'Right-to-left script · ' + c.romanization + ' shown';
  if (c.romanization) return 'New script · ' + c.romanization + ' shown';
  return 'Latin alphabet';
}

export default function Courses({ user, todayXp, courses, enrolled }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

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

  const f = filter.trim().toLowerCase();
  const shown = f
    ? courses.filter((c) => (c.title + ' ' + c.nativeName).toLowerCase().includes(f))
    : courses;

  return (
    <Layout title="Choose a course" user={user} todayXp={todayXp}>
      <h1>I want to learn…</h1>
      <p className="muted">
        {courses.length} courses, all taught from English.
        {!user
          ? ' No account needed to start: try a lesson now and create a free profile later to keep your progress.'
          : ''}
      </p>
      <div className="form-field course-filter">
        <label className="label" htmlFor="course-filter">
          Find a language
        </label>
        <input
          id="course-filter"
          className="input"
          type="search"
          value={filter}
          placeholder="e.g. Japanese"
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {shown.length} courses shown
      </p>
      <ul className="course-grid course-list">
        {shown.map((c) => {
          const current = user && user.currentCourse === c.id;
          const started = enrolled.includes(c.id);
          return (
            <li className={'card course-card' + (current ? ' current' : '')} key={c.id}>
              <div className="course-head">
                <span className="course-badge" aria-hidden="true" lang={c.speechLang} dir={c.dir}>
                  {Array.from(c.nativeName)[0]}
                </span>
                <div>
                  <h2>{c.title}</h2>
                  <p className="native" lang={c.speechLang} dir={c.dir}>
                    {c.nativeName}
                  </p>
                </div>
              </div>
              <p>{c.description}</p>
              <p className="muted small">
                {scriptNote(c)} · {c.units} units · {c.lessons} lessons · {c.exercises} exercises
              </p>
              <button type="button" className="btn btn-block" disabled={busy !== null} onClick={() => choose(c.id)}>
                {busy === c.id ? 'Opening…' : current || started ? 'Continue ' + c.shortName : 'Start ' + c.shortName}
              </button>
            </li>
          );
        })}
      </ul>
      {!shown.length ? <p>No course matches “{filter}”.</p> : null}
    </Layout>
  );
}
