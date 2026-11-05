import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { Icon } from '../../components/Icons';
import { loadUser } from '../../lib/ssr';
import { getCourse, courseOutline } from '../../lib/content';
import { getCourseProgress } from '../../lib/progress';
import { query } from '../../lib/db';
import { MAX_CROWNS } from '../../lib/constants';

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
    user = { ...user, currentCourse: courseId };
  }
  const anyDone = Object.values(progress.times).some((n) => n > 0);
  return {
    props: {
      user,
      todayXp: r.todayXp,
      course: { id: courseId, title: course.meta.title, shortName: course.meta.shortName, speechLang: course.meta.speechLang },
      outline: courseOutline(courseId),
      skills: progress.skills,
      times: progress.times,
      canPractice: anyDone,
    },
  };
}

function Crowns({ n }) {
  return (
    <span className="crowns" title={'Level ' + n + ' of ' + MAX_CROWNS}>
      <Icon name="crown" />
      {n}/{MAX_CROWNS}
      <span className="sr-only"> skill level</span>
    </span>
  );
}

function SkillCard({ skill, state, times, courseId, prevTitle }) {
  const [open, setOpen] = useState(false);
  const locked = !state.unlocked;
  const mastered = state.crowns >= MAX_CROWNS;
  const panelId = 'skill-' + skill.id;
  return (
    <li className={'skill' + (locked ? ' locked' : '') + (mastered ? ' mastered' : '')}>
      <div className="skill-row">
        <span className="skill-icon">
          <Icon name={locked ? 'lock' : skill.icon} />
        </span>
        <div className="skill-info">
          <h3>{skill.title}</h3>
          {locked ? (
            <p className="muted small" style={{ margin: 0 }}>
              Locked - reach level 1 in {prevTitle || 'the previous skill'} to open.
            </p>
          ) : (
            <>
              <Crowns n={state.crowns} />
              <div
                className="level-bar"
                role="progressbar"
                aria-label={'Progress to next level in ' + skill.title}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(state.levelProgress * 100)}
              >
                <span style={{ width: Math.round(state.levelProgress * 100) + '%' }} />
              </div>
            </>
          )}
        </div>
      </div>
      {!locked ? (
        <div className="row" style={{ marginTop: 12 }}>
          {mastered ? (
            <span className="done-mark">Mastered</span>
          ) : (
            <Link href={'/lesson/' + courseId + '/' + state.nextLessonId} className="btn">
              {state.crowns === 0 && !times[skill.lessons[0].id] ? 'Start' : 'Continue'}
            </Link>
          )}
          <button
            type="button"
            className="btn btn-secondary skill-toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Hide' : 'Lessons & tips'}
          </button>
        </div>
      ) : null}
      {!locked && open ? (
        <div className="skill-panel" id={panelId}>
          {skill.tip ? (
            <p className="tip">
              <strong>Tip: </strong>
              {skill.tip}
            </p>
          ) : null}
          <ul className="lesson-list">
            {skill.lessons.map((l, i) => {
              const done = times[l.id] || 0;
              const isOpen = state.openLessons[i];
              return (
                <li key={l.id}>
                  <span>
                    {l.title} <span className="muted small">({l.count} exercises)</span>{' '}
                    {done ? <span className="done-mark">done ×{done}</span> : null}
                  </span>
                  {isOpen ? (
                    <Link href={'/lesson/' + courseId + '/' + l.id} className="btn btn-secondary">
                      {done ? 'Redo' : 'Start'}
                      <span className="sr-only"> {skill.title} {l.title}</span>
                    </Link>
                  ) : (
                    <span className="muted small">
                      <Icon name="lock" className="crowns" /> Locked
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export default function Learn({ user, todayXp, course, outline, skills, times, canPractice }) {
  const goalPct = Math.min(100, Math.round((todayXp / user.dailyGoal) * 100));
  let prevTitle = null;
  return (
    <Layout title={course.title} user={user} todayXp={todayXp}>
      <div className="path-top">
        <div>
          <h1 style={{ marginBottom: 2 }}>{course.title}</h1>
          <Link href="/courses" className="small">
            Change course
          </Link>
        </div>
        {canPractice ? (
          <Link href={'/practice/' + course.id} className="btn btn-secondary">
            Practise weak words
          </Link>
        ) : null}
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

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Daily goal</strong>
          <span className="muted">
            {todayXp} / {user.dailyGoal} XP
          </span>
        </div>
        <div className="goal-bar" role="progressbar" aria-label="Daily goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalPct}>
          <span style={{ width: goalPct + '%' }} />
        </div>
      </div>

      {outline.map((unit, ui) => (
        <section className="unit" key={unit.id} aria-labelledby={'unit-' + unit.id}>
          <div className="unit-head">
            <h2 id={'unit-' + unit.id}>
              Unit {ui + 1}: {unit.title}
            </h2>
            {unit.description ? <p>{unit.description}</p> : null}
          </div>
          <ul className="skills">
            {unit.skills.map((s) => {
              const card = (
                <SkillCard key={s.id} skill={s} state={skills[s.id]} times={times} courseId={course.id} prevTitle={prevTitle} />
              );
              prevTitle = s.title;
              return card;
            })}
          </ul>
        </section>
      ))}
    </Layout>
  );
}
