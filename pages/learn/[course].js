import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { Icon } from '../../components/Icons';
import { loadUser } from '../../lib/ssr';
import { getCourse, courseOutline, courseClientInfo } from '../../lib/content';
import { getCourseProgress } from '../../lib/progress';
import { query } from '../../lib/db';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx, { required: true, redirectTo: '/courses' });
  if (!r.user) return r;
  const courseId = String(ctx.params.course || '');
  const course = getCourse(courseId);
  if (!course) return { notFound: true };
  const progress = await getCourseProgress(r.user.id, courseId);
  let user = r.user;
  if (user.currentCourse !== courseId) {
    await query('UPDATE users SET current_course = $2 WHERE id = $1', [user.id, courseId]);
    await query('INSERT INTO enrollments (user_id, course) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, courseId]);
    user = { ...user, currentCourse: courseId };
  }
  const anyDone = Object.values(progress.times).some((n) => n > 0);
  return {
    props: {
      user,
      todayXp: r.todayXp,
      course: courseClientInfo(course),
      outline: courseOutline(courseId),
      map: progress.map,
      canPractice: anyDone,
    },
  };
}

// Zig-zag offsets for the path nodes (in units of node width), repeating.
const OFFSETS = [0, 0.6, 0.9, 0.6, 0, -0.6, -0.9, -0.6];

function PathNode({ lesson, number, state, current, courseId, unitTitle, offset }) {
  const done = state.times > 0;
  const locked = !state.unlocked;
  const status = locked ? 'locked' : done ? 'completed' : current ? 'start here' : 'open';
  const label = 'Lesson ' + number + ': ' + lesson.title + ' (' + unitTitle + '), ' + status;
  const cls = 'path-node' + (done ? ' is-done' : '') + (locked ? ' is-locked' : '') + (current ? ' is-current' : '');
  const icon = locked ? 'lock' : done ? 'check' : current ? 'star' : 'bolt';
  return (
    <li className="path-item" style={{ '--offset': offset }}>
      {current ? (
        <span className="path-bubble" aria-hidden="true">
          {done ? 'Review' : 'Start'}
        </span>
      ) : null}
      {locked ? (
        <span className={cls} role="img" aria-label={label} title={label}>
          <Icon name={icon} />
        </span>
      ) : (
        <Link href={'/lesson/' + courseId + '/' + lesson.id} className={cls} aria-label={label} title={label}>
          <Icon name={icon} />
        </Link>
      )}
      <span className="path-label" aria-hidden="true">
        {lesson.title}
        {done && state.times > 1 ? <span className="muted"> ×{state.times}</span> : null}
      </span>
    </li>
  );
}

function Unit({ unit, index, map, courseId, currentId }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const st = map.units[unit.id];
  const complete = st.done === st.total;
  const firstLocked = !map.lessons[unit.lessons[0].id].unlocked;
  const guideId = 'guide-' + unit.id;
  return (
    <section className={'unit unit-c' + (index % 6) + (firstLocked ? ' unit-locked' : '')} aria-labelledby={'unit-' + unit.id}>
      <div className="unit-banner">
        <div>
          <p className="unit-kicker">
            Unit {index + 1} · {st.done}/{st.total} lessons{complete ? ' · complete' : ''}
          </p>
          <h2 id={'unit-' + unit.id}>{unit.title}</h2>
          {unit.description ? <p className="unit-desc">{unit.description}</p> : null}
        </div>
        {unit.tip ? (
          <button
            type="button"
            className="btn btn-ghost guide-btn"
            aria-expanded={guideOpen}
            aria-controls={guideId}
            onClick={() => setGuideOpen(!guideOpen)}
          >
            <Icon name="star" /> {guideOpen ? 'Hide tips' : 'Tips'}
          </button>
        ) : null}
      </div>
      {unit.tip && guideOpen ? (
        <p className="tip" id={guideId}>
          {unit.tip}
        </p>
      ) : null}
      <ol className="path" aria-label={'Lessons in unit ' + (index + 1)}>
        {unit.lessons.map((l, i) => (
          <PathNode
            key={l.id}
            lesson={l}
            number={i + 1}
            state={map.lessons[l.id]}
            current={l.id === currentId}
            courseId={courseId}
            unitTitle={unit.title}
            offset={OFFSETS[(index * 2 + i) % OFFSETS.length]}
          />
        ))}
      </ol>
    </section>
  );
}

export default function Learn({ user, todayXp, course, outline, map, canPractice }) {
  const goalPct = Math.min(100, Math.round((todayXp / user.dailyGoal) * 100));
  const totalLessons = Object.keys(map.lessons).length;
  const doneLessons = Object.values(map.lessons).filter((l) => l.times > 0).length;
  const currentId = map.finished ? null : map.nextLessonId;
  return (
    <Layout title={course.title} user={user} todayXp={todayXp}>
      <div className="path-top">
        <div>
          <h1 style={{ marginBottom: 2 }}>
            {course.title}{' '}
            <span className="native-inline" lang={course.speechLang} dir={course.dir}>
              {course.nativeName}
            </span>
          </h1>
          <p className="muted small" style={{ margin: 0 }}>
            {doneLessons} of {totalLessons} lessons done · <Link href="/courses">Change course</Link>
          </p>
        </div>
        <div className="row">
          {!map.finished ? (
            <Link href={'/lesson/' + course.id + '/' + map.nextLessonId} className="btn">
              {doneLessons ? 'Continue' : 'Start'}
            </Link>
          ) : null}
          {canPractice ? (
            <Link href={'/practice/' + course.id} className="btn btn-secondary">
              Practise
            </Link>
          ) : null}
        </div>
      </div>

      {user.isGuest ? (
        <p className="alert alert-info">
          You are learning as a guest. <Link href="/signup">Create a free profile</Link> to save your progress.
        </p>
      ) : null}
      {user.hearts === 0 ? (
        <p className="alert alert-error">
          You are out of hearts. {canPractice ? <Link href={'/practice/' + course.id}>Practise</Link> : 'Wait'} to earn
          one back{user.heartsNextAt ? ', or wait for the next one to refill' : ''}.
        </p>
      ) : null}
      {map.finished ? (
        <p className="alert alert-ok">You have finished every lesson in {course.title}. Keep practising to stay sharp!</p>
      ) : null}

      <div className="card goal-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>
            <Icon name="bolt" /> Daily goal
          </strong>
          <span className="muted">
            {todayXp} / {user.dailyGoal} XP
          </span>
        </div>
        <div className="goal-bar" role="progressbar" aria-label="Daily goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalPct}>
          <span style={{ width: goalPct + '%' }} />
        </div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          <Icon name="flame" /> {user.streak} day streak{user.streak ? '' : ' - finish a lesson today to start one'}
        </p>
      </div>

      {outline.map((unit, ui) => (
        <Unit key={unit.id} unit={unit} index={ui} map={map} courseId={course.id} currentId={currentId} />
      ))}
    </Layout>
  );
}
