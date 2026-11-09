// Learning progress, XP, streaks, hearts, learning path, spaced repetition, leaderboard (server-only).
import { query, withTransaction } from './db';
import { getCourse, getLesson, courseIds } from './content';
import { checkAnswer } from './grading';
import { ukDate, addDays, weekStart, displayStreak } from './dates';
import { effectiveHearts, applyHeartDelta } from './hearts';
import {
  LESSON_XP,
  PERFECT_BONUS_XP,
  PRACTICE_XP,
  PRACTICE_SIZE,
} from './constants';
import { HttpError } from './api';
import { computeCourseMap } from './path';

export { computeCourseMap };

// ---------- user shape sent to pages ----------

export function publicUser(row) {
  if (!row) return null;
  const h = effectiveHearts(row.hearts, row.hearts_updated_at);
  return {
    id: row.id,
    email: row.email || null,
    displayName: row.display_name,
    role: row.role,
    isGuest: !!row.is_guest,
    xpTotal: row.xp_total,
    streak: displayStreak(row.streak, row.last_active_date),
    longestStreak: row.longest_streak,
    dailyGoal: row.daily_goal,
    soundOn: !!row.sound_on,
    showOnLeaderboard: !!row.show_on_leaderboard,
    hearts: h.hearts,
    heartsNextAt: h.nextAt,
    currentCourse: row.current_course || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

export async function getTodayXp(userId) {
  const { rows } = await query(
    'SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_events WHERE user_id = $1 AND day = $2::date',
    [userId, ukDate()]
  );
  return rows[0].xp;
}

// ---------- learning path ----------

async function lessonTimes(userId, courseId, db = { query }) {
  const { rows } = await db.query(
    'SELECT lesson_id, times FROM lesson_completions WHERE user_id = $1 AND course = $2',
    [userId, courseId]
  );
  const map = {};
  rows.forEach((r) => {
    map[r.lesson_id] = r.times;
  });
  return map;
}

export async function getCourseProgress(userId, courseId) {
  const course = getCourse(courseId);
  if (!course) return null;
  const times = await lessonTimes(userId, courseId);
  return { times, map: computeCourseMap(course, times) };
}

function lessonIsOpen(map, lessonId) {
  const st = map.lessons[lessonId];
  return !!(st && st.unlocked);
}

export async function canStartLesson(userId, courseId, lessonId) {
  const course = getCourse(courseId);
  if (!course || !course.lessonIndex[lessonId]) return false;
  const times = await lessonTimes(userId, courseId);
  return lessonIsOpen(computeCourseMap(course, times), lessonId);
}

// ---------- hearts ----------

export async function loseHeart(userId) {
  return withTransaction(async (db) => {
    const { rows } = await db.query('SELECT hearts, hearts_updated_at FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!rows[0]) throw new HttpError(404, 'User not found');
    const next = applyHeartDelta(rows[0].hearts, rows[0].hearts_updated_at, -1);
    await db.query('UPDATE users SET hearts = $2, hearts_updated_at = $3 WHERE id = $1', [userId, next.hearts, next.updatedAt]);
    return effectiveHearts(next.hearts, next.updatedAt);
  });
}

// ---------- session completion ----------

function validateItems(items, max) {
  if (!Array.isArray(items) || items.length < 1 || items.length > max) throw new HttpError(400, 'Invalid answers');
  return items.map((it) => {
    if (!it || typeof it !== 'object') throw new HttpError(400, 'Invalid answer item');
    const index = it.index;
    const wrong = it.wrongAttempts === undefined ? 0 : it.wrongAttempts;
    if (!Number.isInteger(index) || index < 0 || index > 100) throw new HttpError(400, 'Invalid exercise index');
    if (!Number.isInteger(wrong) || wrong < 0 || wrong > 50) throw new HttpError(400, 'Invalid attempt count');
    if (it.lessonId !== undefined && (typeof it.lessonId !== 'string' || it.lessonId.length > 40)) throw new HttpError(400, 'Invalid lesson id');
    let size = 0;
    try {
      size = JSON.stringify(it.response === undefined ? null : it.response).length;
    } catch (_) {
      throw new HttpError(400, 'Invalid response');
    }
    if (size > 4000) throw new HttpError(400, 'Response too large');
    return { lessonId: it.lessonId, index, wrongAttempts: wrong, response: it.response };
  });
}

export async function completeSession(userId, input) {
  const courseId = input.course;
  const mode = input.mode;
  const course = getCourse(courseId);
  if (!course) throw new HttpError(400, 'Unknown course');
  if (mode !== 'lesson' && mode !== 'practice') throw new HttpError(400, 'Unknown mode');

  const times = await lessonTimes(userId, courseId);
  const states = computeCourseMap(course, times);
  let items;
  let lessonId = null;

  if (mode === 'lesson') {
    lessonId = input.lessonId;
    const ref = getLesson(courseId, lessonId);
    if (!ref) throw new HttpError(400, 'Unknown lesson');
    if (!lessonIsOpen(states, lessonId)) throw new HttpError(403, 'This lesson is locked');
    items = validateItems(input.items, ref.lesson.exercises.length);
    const seen = new Set();
    items.forEach((it) => {
      if (seen.has(it.index)) throw new HttpError(400, 'Duplicate exercise');
      seen.add(it.index);
      it.lessonId = lessonId;
    });
    if (seen.size !== ref.lesson.exercises.length) throw new HttpError(400, 'Lesson not finished');
  } else {
    items = validateItems(input.items, PRACTICE_SIZE + 5);
    items.forEach((it) => {
      const ref = getLesson(courseId, it.lessonId);
      if (!ref) throw new HttpError(400, 'Unknown lesson in practice');
      if (!(times[it.lessonId] > 0)) throw new HttpError(403, 'Practice item is locked');
    });
  }

  // Re-grade every answer on the server.
  let mistakes = 0;
  const wordDelta = new Map(); // word -> +1 / -1
  for (const it of items) {
    const ex = getLesson(courseId, it.lessonId).lesson.exercises[it.index];
    if (!ex) throw new HttpError(400, 'Unknown exercise');
    const result = checkAnswer(ex, it.response);
    if (!result.correct) throw new HttpError(400, 'An answer did not check out. Please retry the lesson.');
    mistakes += it.wrongAttempts;
    if (result.skipped) continue;
    for (const w of ex.words || []) {
      const d = it.wrongAttempts > 0 ? -1 : 1;
      if (!wordDelta.has(w) || d < 0) wordDelta.set(w, d);
    }
  }

  const xp = mode === 'lesson' ? LESSON_XP + (mistakes === 0 ? PERFECT_BONUS_XP : 0) : PRACTICE_XP;
  const today = ukDate();
  const yesterday = addDays(today, -1);

  const outcome = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `SELECT streak, longest_streak, last_active_date, hearts, hearts_updated_at, daily_goal
       FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    const u = rows[0];
    if (!u) throw new HttpError(404, 'User not found');

    let streak;
    if (u.last_active_date === today) streak = u.streak;
    else if (u.last_active_date === yesterday) streak = u.streak + 1;
    else streak = 1;
    const longest = Math.max(u.longest_streak, streak);
    const streakExtended = u.last_active_date !== today;

    // Practising earns a heart back.
    const hearts = mode === 'practice'
      ? applyHeartDelta(u.hearts, u.hearts_updated_at, +1)
      : { hearts: u.hearts, updatedAt: u.hearts_updated_at };

    await db.query(
      `UPDATE users SET xp_total = xp_total + $2, streak = $3, longest_streak = $4,
         last_active_date = $5::date, hearts = $6, hearts_updated_at = $7,
         current_course = $8, last_seen_at = NOW()
       WHERE id = $1`,
      [userId, xp, streak, longest, today, hearts.hearts, hearts.updatedAt, courseId]
    );
    await db.query(
      'INSERT INTO enrollments (user_id, course) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, courseId]
    );
    await db.query(
      'INSERT INTO xp_events (user_id, course, source, xp, day) VALUES ($1, $2, $3, $4, $5::date)',
      [userId, courseId, mode, xp, today]
    );
    if (mode === 'lesson') {
      await db.query(
        `INSERT INTO lesson_completions (user_id, course, lesson_id, times, last_completed_at)
         VALUES ($1, $2, $3, 1, NOW())
         ON CONFLICT (user_id, course, lesson_id)
         DO UPDATE SET times = lesson_completions.times + 1, last_completed_at = NOW()`,
        [userId, courseId, lessonId]
      );
    }
    if (wordDelta.size) {
      const words = [...wordDelta.keys()].map((w) => String(w).slice(0, 200));
      const deltas = [...wordDelta.values()];
      await db.query(
        `INSERT INTO word_strength (user_id, course, word, strength, correct, wrong, last_seen)
         SELECT $1, $2, t.w, GREATEST(0, t.d), CASE WHEN t.d > 0 THEN 1 ELSE 0 END,
                CASE WHEN t.d < 0 THEN 1 ELSE 0 END, NOW()
         FROM unnest($3::text[], $4::int[]) AS t(w, d)
         ON CONFLICT (user_id, course, word) DO UPDATE SET
           strength = GREATEST(0, LEAST(5, word_strength.strength + EXCLUDED.correct - EXCLUDED.wrong)),
           correct = word_strength.correct + EXCLUDED.correct,
           wrong = word_strength.wrong + EXCLUDED.wrong,
           last_seen = NOW()`,
        [userId, courseId, words, deltas]
      );
    }
    const sum = await db.query(
      'SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_events WHERE user_id = $1 AND day = $2::date',
      [userId, today]
    );
    const eff = effectiveHearts(hearts.hearts, hearts.updatedAt);
    return {
      streak,
      streakExtended,
      todayXp: sum.rows[0].xp,
      dailyGoal: u.daily_goal,
      hearts: eff.hearts,
    };
  });

  let unit = null;
  let nextLessonId = null;
  if (mode === 'lesson') {
    const ref = course.lessonIndex[lessonId];
    const after = computeCourseMap(course, { ...times, [lessonId]: (times[lessonId] || 0) + 1 });
    const u = after.units[ref.unitId];
    const before = states.units[ref.unitId];
    unit = {
      number: ref.unitIndex + 1,
      title: course.units[ref.unitIndex].title,
      done: u.done,
      total: u.total,
      justCompleted: u.done === u.total && before.done < before.total,
    };
    nextLessonId = after.finished ? null : after.nextLessonId;
  }
  return { xp, mistakes, unit, nextLessonId, ...outcome };
}

// ---------- spaced repetition practice ----------

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds up to PRACTICE_SIZE exercises focused on the user's weakest words,
// drawn from lessons they have already completed.
export async function buildPractice(userId, courseId) {
  const course = getCourse(courseId);
  if (!course) return null;
  const times = await lessonTimes(userId, courseId);
  const doneLessons = Object.keys(times).filter((id) => times[id] > 0 && course.lessonIndex[id]);
  if (!doneLessons.length) return { items: [], weakWords: [] };

  // Strength decays by one point per two days unseen (max 3) when ranking.
  const { rows } = await query(
    `SELECT word, strength FROM word_strength
     WHERE user_id = $1 AND course = $2
     ORDER BY strength - LEAST(3, FLOOR(EXTRACT(EPOCH FROM (NOW() - last_seen)) / 172800)) ASC, last_seen ASC
     LIMIT 12`,
    [userId, courseId]
  );
  const weakWords = rows.map((r) => r.word);

  const pool = [];
  doneLessons.forEach((lid) => {
    course.lessonIndex[lid].lesson.exercises.forEach((ex, index) => pool.push({ lessonId: lid, index, ex }));
  });
  const shuffled = shuffle(pool);
  const chosen = [];
  const used = new Set();
  const take = (p) => {
    const key = p.lessonId + ':' + p.index;
    if (used.has(key) || chosen.length >= PRACTICE_SIZE) return;
    used.add(key);
    chosen.push(p);
  };
  for (const w of weakWords) {
    const hit = shuffled.find((p) => !used.has(p.lessonId + ':' + p.index) && (p.ex.words || []).includes(w));
    if (hit) take(hit);
  }
  for (const p of shuffled) take(p);

  return {
    weakWords: weakWords.slice(0, 6),
    items: shuffle(chosen).map((p) => ({ lessonId: p.lessonId, index: p.index, exercise: p.ex })),
  };
}

// ---------- leaderboard, profile, admin ----------

export async function getLeaderboard(userId) {
  const start = weekStart(ukDate());
  const { rows } = await query(
    `SELECT u.id, u.display_name, SUM(x.xp) AS xp
     FROM xp_events x JOIN users u ON u.id = x.user_id
     WHERE x.day >= $1::date AND u.is_guest = FALSE AND u.show_on_leaderboard = TRUE
     GROUP BY u.id, u.display_name
     ORDER BY xp DESC, u.id ASC
     LIMIT 50`,
    [start]
  );
  const mine = await query(
    'SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_events WHERE user_id = $1 AND day >= $2::date',
    [userId, start]
  );
  return {
    weekStart: start,
    entries: rows.map((r, i) => ({ rank: i + 1, id: r.id, name: r.display_name, xp: r.xp, me: r.id === userId })),
    myXp: mine.rows[0].xp,
  };
}

export async function getProfileStats(userId) {
  const today = ukDate();
  const from = addDays(today, -6);
  const daily = await query(
    `SELECT day, SUM(xp) AS xp FROM xp_events WHERE user_id = $1 AND day >= $2::date GROUP BY day`,
    [userId, from]
  );
  const byDay = {};
  daily.rows.forEach((r) => {
    byDay[r.day] = r.xp;
  });
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    week.push({ day: d, xp: byDay[d] || 0 });
  }

  const courses = [];
  const mine = await query(
    `SELECT course FROM enrollments WHERE user_id = $1
     UNION SELECT DISTINCT course FROM lesson_completions WHERE user_id = $1`,
    [userId]
  );
  const myIds = new Set(mine.rows.map((r) => r.course));
  for (const id of courseIds()) {
    if (!myIds.has(id)) continue;
    const course = getCourse(id);
    const times = await lessonTimes(userId, id);
    const map = computeCourseMap(course, times);
    const totalLessons = course.lessonOrder.length;
    const doneLessons = Object.keys(times).filter((l) => times[l] > 0 && course.lessonIndex[l]).length;
    const unitsDone = Object.values(map.units).filter((u) => u.done === u.total).length;
    const words = await query(
      `SELECT COUNT(*) FILTER (WHERE strength >= 1) AS learned,
              COUNT(*) FILTER (WHERE strength <= 1) AS weak
       FROM word_strength WHERE user_id = $1 AND course = $2`,
      [userId, id]
    );
    courses.push({
      id,
      title: course.meta.title,
      doneLessons,
      totalLessons,
      unitsDone,
      totalUnits: course.units.length,
      wordsLearned: words.rows[0].learned,
      weakWords: words.rows[0].weak,
    });
  }
  return { week, courses };
}

export async function getAdminStats() {
  const today = ukDate();
  const counts = await query(
    `SELECT COUNT(*) FILTER (WHERE NOT is_guest) AS users,
            COUNT(*) FILTER (WHERE is_guest) AS guests,
            COUNT(*) FILTER (WHERE role = 'admin') AS admins
     FROM users`
  );
  const active = await query('SELECT COUNT(DISTINCT user_id) AS n FROM xp_events WHERE day = $1::date', [today]);
  const activeWeek = await query('SELECT COUNT(DISTINCT user_id) AS n FROM xp_events WHERE day >= $1::date', [addDays(today, -6)]);
  const perCourse = [];
  for (const id of courseIds()) {
    const course = getCourse(id);
    const e = await query('SELECT COUNT(*) AS n FROM enrollments WHERE course = $1', [id]);
    const l = await query('SELECT COALESCE(SUM(times), 0) AS n, COUNT(DISTINCT user_id) AS learners FROM lesson_completions WHERE course = $1', [id]);
    const x = await query('SELECT COALESCE(SUM(xp), 0) AS n FROM xp_events WHERE course = $1', [id]);
    const top = await query(
      `SELECT lesson_id, SUM(times) AS n FROM lesson_completions WHERE course = $1
       GROUP BY lesson_id ORDER BY n DESC LIMIT 5`,
      [id]
    );
    perCourse.push({
      id,
      title: course.meta.title,
      enrollments: e.rows[0].n,
      completions: l.rows[0].n,
      learners: l.rows[0].learners,
      xp: x.rows[0].n,
      lessons: Object.keys(course.lessonIndex).length,
      topLessons: top.rows.map((r) => ({ lessonId: r.lesson_id, n: r.n })),
    });
  }
  const users = await query(
    `SELECT id, email, display_name, role, is_guest, xp_total, streak, last_active_date, created_at
     FROM users WHERE is_guest = FALSE ORDER BY created_at DESC LIMIT 200`
  );
  return {
    totals: { ...counts.rows[0], activeToday: active.rows[0].n, activeWeek: activeWeek.rows[0].n },
    perCourse,
    users: users.rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.display_name,
      role: u.role,
      xp: u.xp_total,
      streak: displayStreak(u.streak, u.last_active_date, today),
      lastActive: u.last_active_date,
      createdAt: new Date(u.created_at).toISOString(),
    })),
  };
}
