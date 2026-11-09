// One-exercise-at-a-time player used by lessons and practice.
// Wrong answers show the correct answer and the exercise is asked again at the end,
// so a finished session always contains a correct response for every exercise
// (the server re-grades all of them before awarding XP).
import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Icon, LoopArt } from './Icons';
import {
  EXERCISE_COMPONENTS,
  isReady,
  answerRoman,
  promptText,
  responseText,
  TargetText,
  SpeakButton,
  HintContext,
} from './Exercises';
import { buildHintIndex } from '../lib/hints';
import { speak } from '../lib/speech';
import { checkAnswer } from '../lib/grading';
import { postJson } from '../lib/client';
import { playCorrect, playWrong, playComplete } from '../lib/sfx';

function minutesUntil(ms) {
  if (!ms) return null;
  return Math.max(1, Math.ceil((ms - Date.now()) / 60000));
}

// Text in the course language when the answer is in that language, else English.
function AnswerText({ ex, text, course }) {
  const target =
    (ex.type === 'mc' && ex.promptLang !== 'target') ||
    (ex.type === 'tap' && ex.promptLang !== 'target') ||
    (ex.type === 'type' && ex.promptLang === 'en') ||
    ex.type === 'listen';
  if (!target) return <span lang="en">{text}</span>;
  return <TargetText text={text} roman={answerRoman(ex)} course={course} />;
}

function Feedback({ ex, feedback, course, usesHearts }) {
  if (!feedback.correct) {
    return (
      <>
        <h2>Not quite</h2>
        <p>
          Correct answer: <strong><AnswerText ex={ex} text={feedback.answer} course={course} /></strong>
        </p>
        {ex.type === 'listen' && ex.translation ? <p className="small">Meaning: {ex.translation}</p> : null}
        {usesHearts ? <p className="small">You lost a heart. This one will come back later.</p> : null}
      </>
    );
  }
  let title = 'Correct!';
  if (feedback.skipped) title = 'Skipped';
  else if (feedback.accent) title = 'Correct - watch the accents';
  else if (feedback.typo) title = 'Correct - watch the spelling';
  const showAnswer = feedback.typo || feedback.accent || feedback.skipped || ex.type === 'listen' || ex.type === 'type';
  return (
    <>
      <h2>{title}</h2>
      {showAnswer ? (
        <p>
          {feedback.skipped ? 'It said: ' : 'Answer: '}
          <AnswerText ex={ex} text={feedback.answer} course={course} />
          {ex.type === 'listen' && ex.translation ? <> - &ldquo;{ex.translation}&rdquo;</> : null}
        </p>
      ) : null}
    </>
  );
}

function MistakesReview({ review, course }) {
  if (!review.length) return null;
  return (
    <section className="card review" aria-labelledby="review-h">
      <h2 id="review-h">Review your mistakes</h2>
      <ul className="review-list">
        {review.map((r) => (
          <li key={r.pos}>
            <p className="review-prompt">{promptText(r.ex)}</p>
            {responseText(r.ex, r.response) ? (
              <p className="review-yours">
                <span className="sr-only">Your answer: </span>
                <Icon name="close" /> <span dir="auto">{responseText(r.ex, r.response)}</span>
              </p>
            ) : null}
            <p className="review-right">
              <span className="sr-only">Correct answer: </span>
              <Icon name="check" /> <AnswerText ex={r.ex} text={r.answer} course={course} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// "New words" cards shown before the first exercise of a lesson.
function TeachCards({ teach, course, soundOn, onDone, onQuit }) {
  const [i, setI] = useState(0);
  const nextRef = useRef(null);
  const card = teach[i];
  useEffect(() => {
    if (soundOn) speak(card.t, course.speechLang);
    if (nextRef.current) nextRef.current.focus();
  }, [i, card.t, course.speechLang, soundOn]);
  const last = i === teach.length - 1;
  function next(e) {
    e.preventDefault();
    if (last) onDone();
    else setI(i + 1);
  }
  const pct = Math.round(((i + 1) / teach.length) * 100);
  return (
    <form onSubmit={next} style={{ display: 'contents' }}>
      <div className="player-top">
        <button type="button" className="close-btn" onClick={onQuit} aria-label="Quit and go back">
          <Icon name="close" />
        </button>
        <div className="progress" role="progressbar" aria-label="New words" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: pct + '%' }} />
        </div>
        <span className="stat stat-xp">
          {i + 1}/{teach.length}
        </span>
      </div>
      <main className="player-body" id="main">
        <h1 className="ex-instruction">{card.kind === 'phrase' ? 'New phrase' : 'New word'}</h1>
        <div className="teach-card" aria-live="polite">
          <SpeakButton text={card.t} lang={course.speechLang} big label={'Listen: ' + card.t} />
          <p className="teach-target">
            <TargetText text={card.t} roman={card.r} course={course} />
          </p>
          <p className="teach-meaning" lang="en">
            {card.e}
          </p>
          {card.alts && card.alts.length ? (
            <p className="muted small" dir="ltr">
              Also:{' '}
              <bdi lang={course.speechLang} dir={course.dir}>
                {card.alts.join(' · ')}
              </bdi>
            </p>
          ) : null}
        </div>
      </main>
      <div className="player-foot">
        <div className="foot-inner">
          <div className="feedback">
            <p className="small muted" style={{ margin: 0 }}>
              Learn these first - the exercises use them next.
            </p>
          </div>
          <div className="foot-actions">
            {i > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={() => setI(i - 1)}>
                Back
              </button>
            ) : null}
            <button type="submit" ref={nextRef} className="btn">
              {last ? 'Start exercises' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function LessonPlayer({
  mode, // 'lesson' | 'practice'
  course, // courseClientInfo(): { id, title, shortName, speechLang, dir, romanization, keyboard }
  lessonId,
  title,
  items, // [{ lessonId, index, exercise }]
  initialHearts,
  heartsNextAt,
  soundOn,
  isGuest,
  backHref,
  teach = [], // [{ t, e, r?, kind, alts? }] new words for this lesson
  hints = [], // [{ forms, e, r }] words the learner can tap for a meaning
}) {
  const router = useRouter();
  const [intro, setIntro] = useState(mode === 'lesson' && teach.length > 0);
  const hintIndex = useMemo(() => (hints.length ? buildHintIndex(hints) : null), [hints]);
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
  const [review, setReview] = useState([]); // [{ pos, ex, response, answer }] first wrong answer per exercise
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
      if (!review.some((r) => r.pos === current)) {
        setReview((r) => r.concat({ pos: current, ex, response: resp, answer: result.answer }));
      }
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
          {summary.unit ? (
            <p className="crowns" style={{ justifyContent: 'center', display: 'flex' }}>
              <Icon name="trophy" />
              {summary.unit.justCompleted
                ? 'Unit ' + summary.unit.number + ' complete!'
                : 'Unit ' + summary.unit.number + ': ' + summary.unit.done + ' of ' + summary.unit.total + ' lessons done'}
            </p>
          ) : null}
          {mode === 'practice' ? <p className="muted small">Practice earns a heart back. Hearts: {hearts}</p> : null}
          <MistakesReview review={review} course={course} />
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
          <div className="complete-actions">
            {mode === 'lesson' && summary.nextLessonId ? (
              <Link href={'/lesson/' + course.id + '/' + summary.nextLessonId} className="btn btn-ok btn-block">
                Next lesson
              </Link>
            ) : null}
            <Link href={backHref} className={'btn btn-block' + (mode === 'lesson' && summary.nextLessonId ? ' btn-secondary' : '')}>
              Back to the path
            </Link>
          </div>
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

  if (intro) {
    return (
      <div className="player">
        <Head>
          <title>{'New words · ' + title + ' · LinguaLoop'}</title>
        </Head>
        <TeachCards teach={teach} course={course} soundOn={soundOn} onDone={() => setIntro(false)} onQuit={() => router.push(backHref)} />
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
          <HintContext.Provider value={hintIndex}>
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
                course={course}
                soundOn={soundOn}
              />
            </>
          ) : null}
          </HintContext.Provider>
        </main>

        <div className={footClass}>
          <div className="foot-inner">
            <div className="feedback" aria-live="assertive">
              {phase === 'feedback' && feedback ? <Feedback ex={ex} feedback={feedback} course={course} usesHearts={usesHearts} /> : null}
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
