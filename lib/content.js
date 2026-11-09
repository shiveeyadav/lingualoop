// Course content loader + validator (server-only, CommonJS so scripts/init-db.js can reuse it).
//
// Every course is ONE file: content/<id>.json with the schema
//   { id, title, ..., units: [ { id, title, lessons: [ { id, title, exercises: [...] } ] } ] }
// Courses are discovered from the directory, so adding a language = adding one file.
// Content is read lazily on first use and cached; init-db.js calls loadAllCourses() before
// the server starts so invalid content stops the deploy instead of failing at request time.
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(process.cwd(), 'content');
const TYPES = ['mc', 'tap', 'type', 'match', 'listen'];
const ID_RE = /^[a-z0-9]+$/i;
const COURSE_ID_RE = /^[a-z][a-z0-9-]{1,30}$/;

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

// Optional romanization array that must line up 1:1 with another array.
function checkParallel(where, name, arr, against) {
  if (arr === undefined) return;
  if (!Array.isArray(arr) || arr.length !== against.length) fail(where, name + ' must have one entry per item');
  arr.forEach((s, i) => {
    if (typeof s !== 'string') fail(where, name + '[' + i + '] must be a string');
  });
}

function checkOptionalString(where, name, v) {
  if (v !== undefined && typeof v !== 'string') fail(where, name + ' must be a string');
}

function validateExercise(where, ex) {
  if (!ex || typeof ex !== 'object') fail(where, 'exercise must be an object');
  if (!TYPES.includes(ex.type)) fail(where, 'unknown exercise type "' + ex.type + '"');
  if (!isNonEmptyString(ex.instruction)) fail(where, 'missing instruction');
  if (!Array.isArray(ex.words)) fail(where, 'words must be an array');
  checkOptionalString(where, 'promptRoman', ex.promptRoman);
  switch (ex.type) {
    case 'mc': {
      if (!isNonEmptyString(ex.prompt)) fail(where, 'mc needs a prompt');
      checkStringArray(where, 'options', ex.options, 2);
      if (new Set(ex.options).size !== ex.options.length) fail(where, 'mc options must be unique');
      if (!ex.options.includes(ex.answer)) fail(where, 'mc answer "' + ex.answer + '" is not among the options');
      checkParallel(where, 'optionsRoman', ex.optionsRoman, ex.options);
      break;
    }
    case 'tap': {
      if (!isNonEmptyString(ex.prompt)) fail(where, 'tap needs a prompt');
      checkStringArray(where, 'tiles', ex.tiles, 2);
      checkStringArray(where, 'answer', ex.answer, 1);
      checkParallel(where, 'tilesRoman', ex.tilesRoman, ex.tiles);
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
      checkOptionalString(where, 'roman', ex.roman);
      if (ex.options !== undefined) {
        checkStringArray(where, 'options', ex.options, 2);
        if (new Set(ex.options).size !== ex.options.length) fail(where, 'listen options must be unique');
        if (!ex.options.includes(ex.text)) fail(where, 'listen options must include the spoken text');
        checkParallel(where, 'optionsRoman', ex.optionsRoman, ex.options);
      } else {
        checkStringArray(where, 'answers', ex.answers, 1);
        if (!ex.answers.includes(ex.text)) fail(where, 'listen answers must include the spoken text');
      }
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
      checkParallel(where, 'romans', ex.romans, ex.pairs);
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

// Validates one course object (already parsed) and builds lookup indexes.
function buildCourse(id, data) {
  if (!data || typeof data !== 'object') fail(id, 'course must be an object');
  if (data.id !== id) fail(id, 'course id must match its file name ("' + id + '")');
  ['title', 'shortName', 'speechLang', 'description'].forEach((k) => {
    if (!isNonEmptyString(data[k])) fail(id, 'missing ' + k);
  });
  if (data.dir !== undefined && data.dir !== 'ltr' && data.dir !== 'rtl') fail(id, 'dir must be "ltr" or "rtl"');
  if (data.keyboard !== undefined) checkStringArray(id, 'keyboard', data.keyboard, 0);
  checkOptionalString(id, 'romanization', data.romanization);
  if (!Array.isArray(data.units) || data.units.length === 0) fail(id, 'course needs units');

  const meta = {
    id,
    title: data.title,
    shortName: data.shortName,
    nativeName: data.nativeName || '',
    description: data.description,
    speechLang: data.speechLang,
    dir: data.dir || 'ltr',
    romanization: data.romanization || '',
    noSpaces: !!data.noSpaces,
    keyboard: data.keyboard || [],
    order: Number.isFinite(data.order) ? data.order : 1000,
  };

  const lessonIndex = {};
  const lessonOrder = [];
  const seenIds = new Set();
  const units = data.units.map((unit, ui) => {
    const uw = id + ' unit ' + (ui + 1);
    if (!ID_RE.test(unit.id || '') || !isNonEmptyString(unit.title)) fail(uw, 'unit needs an alphanumeric id and a title');
    if (seenIds.has(unit.id)) fail(uw, 'duplicate id ' + unit.id);
    seenIds.add(unit.id);
    if (!Array.isArray(unit.lessons) || unit.lessons.length === 0) fail(uw, 'unit needs lessons');
    unit.lessons.forEach((lesson) => {
      const lw = uw + ' ' + lesson.id;
      if (!ID_RE.test(lesson.id || '')) fail(lw, 'lesson id must be alphanumeric');
      if (seenIds.has(lesson.id)) fail(lw, 'duplicate id');
      seenIds.add(lesson.id);
      if (!isNonEmptyString(lesson.title)) fail(lw, 'lesson needs a title');
      if (!Array.isArray(lesson.exercises) || lesson.exercises.length < 1) fail(lw, 'lesson needs exercises');
      lesson.exercises.forEach((ex, i) => validateExercise(lw + ' #' + i, ex));
      lessonIndex[lesson.id] = { lesson, unitId: unit.id, unitIndex: ui, order: lessonOrder.length };
      lessonOrder.push(lesson.id);
    });
    return unit;
  });

  return { meta, units, lessonIndex, lessonOrder };
}

function loadCourseFile(file) {
  const id = path.basename(file, '.json');
  if (!COURSE_ID_RE.test(id)) fail(file, 'course file names must be lower-case ids like "spanish.json"');
  return buildCourse(id, readJson(file));
}

function loadAllCourses() {
  if (cache) return cache;
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(CONTENT_DIR, f));
  if (!files.length) throw new Error('No course files found in ' + CONTENT_DIR);
  const list = files.map(loadCourseFile);
  list.sort((a, b) => a.meta.order - b.meta.order || a.meta.title.localeCompare(b.meta.title));
  const courses = {};
  list.forEach((c) => {
    courses[c.meta.id] = c;
  });
  cache = courses;
  return cache;
}

function courseIds() {
  return Object.keys(loadAllCourses());
}

function getCourse(id) {
  if (typeof id !== 'string') return null;
  const all = loadAllCourses();
  return Object.prototype.hasOwnProperty.call(all, id) ? all[id] : null;
}

function getLesson(courseId, lessonId) {
  const c = getCourse(courseId);
  if (!c || typeof lessonId !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(c.lessonIndex, lessonId) ? c.lessonIndex[lessonId] : null;
}

// Display settings the client needs to render a course's text correctly.
function courseClientInfo(courseOrId) {
  const c = typeof courseOrId === 'string' ? getCourse(courseOrId) : courseOrId;
  if (!c) return null;
  const m = c.meta;
  return {
    id: m.id,
    title: m.title,
    shortName: m.shortName,
    nativeName: m.nativeName,
    speechLang: m.speechLang,
    dir: m.dir,
    romanization: m.romanization,
    keyboard: m.keyboard,
  };
}

// Light summaries safe to send to the client (no exercises).
function listCourses() {
  const all = loadAllCourses();
  return Object.keys(all).map((id) => {
    const c = all[id];
    let exercises = 0;
    c.lessonOrder.forEach((lid) => {
      exercises += c.lessonIndex[lid].lesson.exercises.length;
    });
    return {
      ...courseClientInfo(c),
      description: c.meta.description,
      units: c.units.length,
      lessons: c.lessonOrder.length,
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
    icon: u.icon || 'star',
    tip: u.tip || '',
    lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, count: l.exercises.length })),
  }));
}

module.exports = {
  loadAllCourses,
  courseIds,
  getCourse,
  getLesson,
  listCourses,
  courseOutline,
  courseClientInfo,
  buildCourse,
};
