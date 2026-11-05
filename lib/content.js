// Course content loader + validator (server-only, CommonJS so scripts/init-db.js can reuse it).
// Content is read lazily on first use and cached; init-db.js calls loadAllCourses() before
// the server starts so invalid content stops the deploy instead of failing at request time.
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(process.cwd(), 'content');
const COURSE_IDS = ['spanish', 'portuguese'];
const TYPES = ['mc', 'tap', 'type', 'match', 'listen'];

let cache = null;

function fail(where, msg) {
  throw new Error('Invalid content [' + where + ']: ' + msg);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function checkStringArray(where, name, arr, min) {
  if (!Array.isArray(arr) || arr.length < min) fail(where, name + ' must be an array with at least ' + min + ' item(s)');
  arr.forEach((s, i) => {
    if (!isNonEmptyString(s)) fail(where, name + '[' + i + '] must be a non-empty string');
  });
}

function validateExercise(where, ex) {
  if (!ex || typeof ex !== 'object') fail(where, 'exercise must be an object');
  if (!TYPES.includes(ex.type)) fail(where, 'unknown exercise type "' + ex.type + '"');
  if (!isNonEmptyString(ex.instruction)) fail(where, 'missing instruction');
  if (!Array.isArray(ex.words)) fail(where, 'words must be an array');
  switch (ex.type) {
    case 'mc': {
      if (!isNonEmptyString(ex.prompt)) fail(where, 'mc needs a prompt');
      checkStringArray(where, 'options', ex.options, 2);
      if (new Set(ex.options).size !== ex.options.length) fail(where, 'mc options must be unique');
      if (!ex.options.includes(ex.answer)) fail(where, 'mc answer "' + ex.answer + '" is not among the options');
      break;
    }
    case 'tap': {
      if (!isNonEmptyString(ex.prompt)) fail(where, 'tap needs a prompt');
      checkStringArray(where, 'tiles', ex.tiles, 2);
      checkStringArray(where, 'answer', ex.answer, 1);
      const pool = ex.tiles.slice();
      for (const tok of ex.answer) {
        const i = pool.indexOf(tok);
        if (i === -1) fail(where, 'tap answer token "' + tok + '" is not available in tiles');
        pool.splice(i, 1);
      }
      if (ex.accepted !== undefined && !Array.isArray(ex.accepted)) fail(where, 'tap accepted must be an array');
      break;
    }
    case 'type': {
      if (!isNonEmptyString(ex.prompt)) fail(where, 'type needs a prompt');
      checkStringArray(where, 'answers', ex.answers, 1);
      break;
    }
    case 'listen': {
      if (!isNonEmptyString(ex.text)) fail(where, 'listen needs text');
      checkStringArray(where, 'answers', ex.answers, 1);
      if (!ex.answers.includes(ex.text)) fail(where, 'listen answers must include the spoken text');
      break;
    }
    case 'match': {
      if (!Array.isArray(ex.pairs) || ex.pairs.length < 2 || ex.pairs.length > 6) fail(where, 'match needs 2-6 pairs');
      const left = new Set();
      const right = new Set();
      ex.pairs.forEach((p, i) => {
        if (!Array.isArray(p) || p.length !== 2 || !isNonEmptyString(p[0]) || !isNonEmptyString(p[1])) fail(where, 'pair ' + i + ' must be [string, string]');
        left.add(p[0]);
        right.add(p[1]);
      });
      if (left.size !== ex.pairs.length || right.size !== ex.pairs.length) fail(where, 'match pairs must be unique on both sides');
      break;
    }
    default:
      break;
  }
}

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('Invalid JSON in ' + file + ': ' + e.message);
  }
}

function loadCourse(id) {
  const dir = path.join(CONTENT_DIR, id);
  const meta = readJson(path.join(dir, 'course.json'));
  if (meta.id !== id) fail(id, 'course.json id must be "' + id + '"');
  ['title', 'shortName', 'speechLang', 'description'].forEach((k) => {
    if (!isNonEmptyString(meta[k])) fail(id, 'course.json missing ' + k);
  });
  checkStringArray(id, 'units', meta.units, 1);

  const units = [];
  const lessonIndex = {};
  const skillIndex = {};
  const skillOrder = [];
  const seenIds = new Set();

  meta.units.forEach((file) => {
    if (!/^[a-z0-9_-]+\.json$/i.test(file)) fail(id, 'bad unit filename ' + file);
    const unit = readJson(path.join(dir, file));
    const uw = id + '/' + file;
    if (!isNonEmptyString(unit.id) || !isNonEmptyString(unit.title)) fail(uw, 'unit needs id and title');
    if (!Array.isArray(unit.skills) || unit.skills.length === 0) fail(uw, 'unit needs skills');
    unit.skills.forEach((skill) => {
      const sw = uw + ' ' + skill.id;
      if (!/^[a-z0-9]+$/i.test(skill.id || '')) fail(sw, 'skill id must be alphanumeric');
      if (seenIds.has(skill.id)) fail(sw, 'duplicate id');
      seenIds.add(skill.id);
      if (!isNonEmptyString(skill.title)) fail(sw, 'skill needs title');
      if (!Array.isArray(skill.lessons) || skill.lessons.length === 0) fail(sw, 'skill needs lessons');
      skill.lessons.forEach((lesson) => {
        const lw = sw + ' ' + lesson.id;
        if (!/^[a-z0-9]+$/i.test(lesson.id || '')) fail(lw, 'lesson id must be alphanumeric');
        if (seenIds.has(lesson.id)) fail(lw, 'duplicate id');
        seenIds.add(lesson.id);
        if (!Array.isArray(lesson.exercises) || lesson.exercises.length < 1) fail(lw, 'lesson needs exercises');
        lesson.exercises.forEach((ex, i) => validateExercise(lw + ' #' + i, ex));
        lessonIndex[lesson.id] = { lesson, skillId: skill.id, unitId: unit.id };
      });
      skillIndex[skill.id] = { skill, unitId: unit.id, order: skillOrder.length };
      skillOrder.push(skill.id);
    });
    units.push(unit);
  });

  return { meta, units, lessonIndex, skillIndex, skillOrder };
}

function loadAllCourses() {
  if (cache) return cache;
  const courses = {};
  COURSE_IDS.forEach((id) => {
    courses[id] = loadCourse(id);
  });
  cache = courses;
  return cache;
}

function getCourse(id) {
  if (typeof id !== 'string' || !COURSE_IDS.includes(id)) return null;
  return loadAllCourses()[id];
}

function getLesson(courseId, lessonId) {
  const c = getCourse(courseId);
  if (!c || typeof lessonId !== 'string') return null;
  return c.lessonIndex[lessonId] || null;
}

// Light summaries safe to send to the client (no exercises).
function listCourses() {
  const all = loadAllCourses();
  return COURSE_IDS.map((id) => {
    const c = all[id];
    let lessons = 0;
    let exercises = 0;
    let skills = 0;
    c.units.forEach((u) => u.skills.forEach((s) => {
      skills += 1;
      s.lessons.forEach((l) => {
        lessons += 1;
        exercises += l.exercises.length;
      });
    }));
    return {
      id,
      title: c.meta.title,
      shortName: c.meta.shortName,
      nativeName: c.meta.nativeName || '',
      description: c.meta.description,
      speechLang: c.meta.speechLang,
      units: c.units.length,
      skills,
      lessons,
      exercises,
    };
  });
}

function courseOutline(courseId) {
  const c = getCourse(courseId);
  if (!c) return null;
  return c.units.map((u) => ({
    id: u.id,
    title: u.title,
    description: u.description || '',
    skills: u.skills.map((s) => ({
      id: s.id,
      title: s.title,
      icon: s.icon || 'star',
      tip: s.tip || '',
      lessons: s.lessons.map((l) => ({ id: l.id, title: l.title, count: l.exercises.length })),
    })),
  }));
}

module.exports = { COURSE_IDS, loadAllCourses, getCourse, getLesson, listCourses, courseOutline };
