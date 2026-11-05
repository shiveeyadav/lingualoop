// One-exercise-at-a-time player used by lessons and practice.
// Wrong answers show the correct answer and the exercise is asked again at the end,
// so a finished session always contains a correct response for every exercise
// (the server re-grades all of them before awarding XP).
import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Icon, LoopArt } from './Icons';
import { EXERCISE_COMPONENTS, isReady } from './Exercises';
import { checkAnswer } from '../lib/grading';
import { postJson } from '../lib/client';
import { playCorrect, playWrong, playComplete } from '../lib/sfx';

function minutesUntil(ms) {
  if (!ms) return null;
  return Math.max(1, Math.ceil((ms - Date.now()) / 60000));
}

export default function LessonPlayer({
  mode, // 'lesson' | 'practice'
  course, // { id, shortName, speechLang }
  lessonId,
  title,
  items, // [{ lessonId, index, exercise }]
  initialHearts,
  heartsNextAt,
  soundOn,
  isGuest,
  backHref,
}) {
  const router = useRouter();
  const total = items.length;
  const [queue, setQueue] = useState(() => items.map((_, i) => i));
  const [qpos, setQpos] = useState(0);
  const [attempt, setAttempt] = useState(0); // remount key for re-asked items
  const [response, setResponse] = useState(null);
  const [phase, setPhase] = useState('answer'); // answer | feedback | submitting | complete | error | hearts
  const [feedback, setFeedback] = useState(null);
  const [hearts, setHearts] = useState(initialHearts);
  const [nextHeartAt, setNextHeartAt] = useState(heartsNextAt);
  const [done, setDone] = useState({}); // itemPos -> response
  const [mistakes, setMistakes] = useState({}); // itemPos -> count
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const continueRef = useRef(null);

  const usesHearts = mode === 'lesson';
  const current = queue[qpos];
  const item = current === undefined ? null : items[current];
  const ex = item ? item.exercise : null;
  const doneCount = Object.keys(done).length;
  const Exercise = ex ? EXERCISE_COMPONENTS[ex.type] : null;

  function sfx(kind) {
    if (!soundOn) return;
    if (kind === 'ok') playCorrect();
    else if (kind === 'wrong') playWrong();
    else if (kind === 'done') playComplete();
  }

  useEffect(() => {
    if (phase === 'feedback' && continueRef.current) continueRef.current.focus();
  }, [phase]);

  async function loseHeart() {
    if (!usesHearts) return;
    setHearts((h) => Math.max(0, h - 1));
    try {
      const r = await postJson('/api/hearts/lose');
      setHearts(r.hearts);
      setNextHeartAt(r.heartsNextAt);
    } catch (_) {
      // Keep the optimistic value; the server value is shown next page load.
    }
  }

  function addMistake(pos) {
    setMistakes((m) => ({ ...m, [pos]: (m[pos] || 0) + 1 }));
  }

  function check(resp) {
    if (phase !== 'answer' || !ex || !isReady(ex, resp)) return;
    const result = checkAnswer(ex, resp);
    if (result.correct) {
      setDone((d) => ({ ...d, [current]: resp }));
      sfx('ok');
    } else {
      addMistake(current);
      setQueue((q) => q.concat(current)); // ask again later
      sfx('wrong');
      loseHeart();
    }
    setFeedback(result);
    setPhase('feedback');
  }

  function onChange(resp, autoCheck) {
    setResponse(resp);
    if (autoCheck) check(resp);
  }

  async function submit(finalDone) {
    setPhase('submitting');
    setError('');
    try {
      const payload = {
        course: course.id,
        mode,
        lessonId: mode === 'lesson' ? lessonId : undefined,
        items: items.map((it, i) => ({
          lessonId: it.lessonId,
          index: it.index,
          wrongAttempts: mistakes[i] || 0,
          response: finalDone[i],
        })),
      };
      const r = await postJson('/api/session/complete', payload);
      setSummary(r);
      if (typeof r.hearts === 'number') setHearts(r.hearts);
      setPhase('complete');
      sfx('done');
    } catch (e) {
      setError(e.message || 'Could not save your progress.');
      setPhase('error');
    }
  }

  function next() {
    if (usesHearts && hearts <= 0) {
      setPhase('hearts');
      return;
    }
    if (Object.keys(done).length >= total) {
      submit(done);
      return;
    }
    setQpos((p) => p + 1);
    setAttempt((a) => a + 1);
    setResponse(null);
    setFeedback(null);
    setPhase('answer');
  }

  function onSubmit(e) {
    e.preventDefault();
    if (phase === 'answer') check(response);
    else if (phase === 'feedback') next();
  }

  function quit() {
    const started = doneCount > 0 || Object.keys(mistakes).length > 0;
    if (phase !== 'complete' && started && !window.confirm('Quit now? Progress in this session will be lost.')) return;
    router.push(backHref);
  }

  const pct = useMemo(() => Math.round((doneCount / Math.max(1, total)) * 100), [doneCount, total]);

  // ---------- end states ----------

  if (phase === 'complete' && summary) {
    const goalMet = summary.todayXp >= summary.dailyGoal;
    return (
      <div className="player">
        <Head>
          <title>{(mode === 'lesson' ? 'Lesson complete' : 'Practice complete') + ' · LinguaLoop'}</title>
        </Head>
        <main className="player-body complete" id="main">
          <LoopArt className="celebrate" />
          <h1>{mode === 'lesson' ? 'Lesson complete!' : 'Practice complete!'}</h1>
          <p className="muted">
            {summary.mistakes === 0 ? 'Perfect run - no mistakes.' : 'Nice work. Mistakes are how you learn.'}
          </p>
          <div className="complete-stats">
            <div className="complete-stat">
              <strong>+{summary.xp}</strong>
              XP
            </div>
            <div className="complete-stat">
              <strong>{summary.streak}</strong>
              day streak{summary.streakExtended ? ' (+1)' : ''}
            </div>
            <div className="complete-stat">
              <strong>
                {summary.todayXp}/{summary.dailyGoal}
              </strong>
              daily goal
            </div>
          </div>
          <div className="goal-bar" aria-hidden="true" style={{ marginBottom: 12 }}>
            <span style={{ width: Math.min(100, (summary.todayXp / summary.dailyGoal) * 100) + '%' }} />
          </div>
          {goalMet ? <p className="alert alert-ok">Daily goal reached. See you tomorrow!</p> : null}
          {summary.crowns ? (
            <p className="crowns" style={{ justifyContent: 'center', display: 'flex' }}>
              <Icon name="crown" /> Skill level {summary.crowns}
            </p>
          ) : null}
          {mode === 'practice' ? <p className="muted small">Practice earns a heart back. Hearts: {hearts}</p> : null}
          {isGuest ? (
            <div className="card">
              <p>
                <strong>Keep your progress.</strong> Create a free profile so your streak and XP are saved.
              </p>
              <Link href="/signup" className="btn btn-ok btn-block">
                Create a profile
              </Link>
            </div>
          ) : null}
          <Link href={backHref} className="btn btn-block">
            Continue
          </Link>
        </main>
      </div>
    );
  }

  if (phase === 'hearts') {
    const mins = minutesUntil(nextHeartAt);
    return (
      <div className="player">
        <Head>
          <title>Out of hearts · LinguaLoop</title>
        </Head>
        <main className="player-body complete" id="main">
          <Icon name="heart" className="celebrate" />
          <h1>You are out of hearts</h1>
          <p>
            Hearts come back over time{mins ? ' - the next one in about ' + mins + ' min' : ''}. Practising words you
            have learned earns one back straight away.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link href={'/practice/' + course.id} className="btn">
              Practise to earn a heart
            </Link>
            <Link href={backHref} className="btn btn-secondary">
              Back to course
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ---------- main player ----------

  const footClass =
    'player-foot' + (phase === 'feedback' ? (feedback && feedback.correct ? ' is-ok' : ' is-bad') : '');
  const ready = ex ? isReady(ex, response) : false;

  return (
    <div className="player">
      <Head>
        <title>{title + ' · LinguaLoop'}</title>
      </Head>
      <form onSubmit={onSubmit} style={{ display: 'contents' }}>
        <div className="player-top">
          <button type="button" className="close-btn" onClick={quit} aria-label="Quit and go back">
            <Icon name="close" />
          </button>
          <div
            className="progress"
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ width: pct + '%' }} />
          </div>
          {usesHearts ? (
            <span className="stat stat-hearts" title="Hearts">
              <Icon name="heart" />
              {hearts}
              <span className="sr-only"> hearts left</span>
            </span>
          ) : (
            <span className="stat stat-xp">Practice</span>
          )}
        </div>

        <main className="player-body" id="main">
          {ex && Exercise ? (
            <>
              <h1 className="ex-instruction">{ex.instruction}</h1>
              <Exercise
                key={current + ':' + attempt}
                ex={ex}
                disabled={phase !== 'answer'}
                onChange={onChange}
                onMistake={() => {
                  addMistake(current);
                }}
                sfx={sfx}
                speechLang={course.speechLang}
                soundOn={soundOn}
              />
            </>
          ) : null}
        </main>

        <div className={footClass}>
          <div className="foot-inner">
            <div className="feedback" aria-live="assertive">
              {phase === 'feedback' && feedback ? (
                feedback.correct ? (
                  <>
                    <h2>{feedback.skipped ? 'Skipped' : feedback.typo ? 'Correct - watch the spelling' : 'Correct!'}</h2>
                    {feedback.typo || feedback.skipped || (ex && (ex.type === 'listen' || ex.type === 'type')) ? (
                      <p>
                        {feedback.skipped ? 'It said: ' : 'Answer: '}
                        <span lang={ex && ex.type === 'listen' ? course.speechLang : undefined}>{feedback.answer}</span>
                        {ex && ex.type === 'listen' && ex.translation ? <> ({ex.translation})</> : null}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <h2>Not quite</h2>
                    <p>
                      Correct answer: <strong>{feedback.answer}</strong>
                    </p>
                    {usesHearts ? <p className="small">You lost a heart. This one will come back later.</p> : null}
                  </>
                )
              ) : null}
              {phase === 'error' ? (
                <div className="alert alert-error" role="alert">
                  {error}
                </div>
              ) : null}
            </div>
            <div className="foot-actions">
              {phase === 'answer' ? (
                <button type="submit" className="btn" disabled={!ready}>
                  Check
                </button>
              ) : null}
              {phase === 'feedback' ? (
                <button type="submit" ref={continueRef} className={'btn ' + (feedback && feedback.correct ? 'btn-ok' : 'btn-danger')}>
                  Continue
                </button>
              ) : null}
              {phase === 'submitting' ? (
                <button type="button" className="btn" disabled>
                  Saving…
                </button>
              ) : null}
              {phase === 'error' ? (
                <button type="button" className="btn" onClick={() => submit(done)}>
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
