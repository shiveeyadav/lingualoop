import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { computeCourseMap } from '../lib/path.js';

const require = createRequire(import.meta.url);
const { loadAllCourses, listCourses } = require('../lib/content.js');

const course = {
  lessonOrder: ['u1l1', 'u1l2', 'u2l1'],
  units: [
    { id: 'u1', lessons: [{ id: 'u1l1' }, { id: 'u1l2' }] },
    { id: 'u2', lessons: [{ id: 'u2l1' }] },
  ],
};

test('only the first lesson is open at the start', () => {
  const m = computeCourseMap(course, {});
  assert.deepEqual(Object.values(m.lessons).map((l) => l.unlocked), [true, false, false]);
  assert.equal(m.nextLessonId, 'u1l1');
  assert.equal(m.finished, false);
});

test('finishing a lesson opens the next one', () => {
  const m = computeCourseMap(course, { u1l1: 1 });
  assert.equal(m.lessons.u1l2.unlocked, true);
  assert.equal(m.lessons.u2l1.unlocked, false);
  assert.equal(m.nextLessonId, 'u1l2');
  assert.deepEqual(m.units.u1, { done: 1, total: 2 });
});

test('a finished course points back at the first lesson', () => {
  const m = computeCourseMap(course, { u1l1: 2, u1l2: 1, u2l1: 1 });
  assert.equal(m.finished, true);
  assert.equal(m.nextLessonId, 'u1l1');
});

test('all course files load and validate', () => {
  const all = loadAllCourses();
  assert.ok(Object.keys(all).length >= 2);
  for (const c of listCourses()) {
    assert.ok(c.units >= 4, c.id + ' has at least 4 units');
    assert.ok(c.lessons >= 16, c.id + ' has at least 16 lessons');
  }
});
