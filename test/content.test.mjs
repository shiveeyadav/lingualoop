// Every exercise in every course must accept its own correct answer and reject
// the wrong options. Catches content that the validator alone cannot see.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { checkAnswer } from '../lib/grading.js';

const require = createRequire(import.meta.url);
const { loadAllCourses } = require('../lib/content.js');
const courses = loadAllCourses();

for (const [id, course] of Object.entries(courses)) {
  test(id + ': structure', () => {
    assert.ok(course.units.length >= 4, 'at least 4 units');
    for (const u of course.units) {
      assert.ok(u.lessons.length >= 4 && u.lessons.length <= 5, u.id + ' has 4-5 lessons');
      for (const l of u.lessons) {
        assert.ok(l.exercises.length >= 6 && l.exercises.length <= 10, l.id + ' has 6-10 exercises');
      }
    }
    if (course.meta.romanization) {
      for (const lid of course.lessonOrder) {
        for (const ex of course.lessonIndex[lid].lesson.exercises) {
          if (ex.type === 'match') assert.ok(ex.romans, lid + ' match has romanization');
          if (ex.promptLang === 'target') assert.ok(ex.promptRoman, lid + ' prompt has romanization');
          if (ex.type === 'tap' && ex.promptLang === 'en') assert.ok(ex.tilesRoman, lid + ' tiles have romanization');
          if (ex.type === 'listen') assert.ok(ex.options && ex.roman, lid + ' listen is choose-with-romanization');
        }
      }
    }
  });

  test(id + ': every answer grades as correct, wrong options as wrong', () => {
    for (const lid of course.lessonOrder) {
      course.lessonIndex[lid].lesson.exercises.forEach((ex, i) => {
        const where = id + ' ' + lid + ' #' + i + ' (' + ex.type + ')';
        switch (ex.type) {
          case 'mc':
            assert.equal(checkAnswer(ex, ex.answer).correct, true, where);
            ex.options.filter((o) => o !== ex.answer).forEach((o) => assert.equal(checkAnswer(ex, o).correct, false, where + ' ' + o));
            break;
          case 'tap':
            assert.equal(checkAnswer(ex, ex.answer).correct, true, where);
            if (ex.answer.length > 1) {
              const rev = ex.answer.slice().reverse();
              if (rev.join(' ') !== ex.answer.join(' ')) {
                const ok = checkAnswer(ex, rev).correct;
                // A reversed sentence may only pass if it is a listed alternative.
                if (ok) assert.ok((ex.accepted || []).length, where + ' reversed order passed');
              }
            }
            break;
          case 'type':
            ex.answers.forEach((a) => {
              const r = checkAnswer(ex, a);
              assert.equal(r.correct && !r.accent && !r.typo, true, where + ' ' + a);
            });
            break;
          case 'listen':
            assert.equal(checkAnswer(ex, ex.text).correct, true, where);
            if (ex.options) ex.options.filter((o) => o !== ex.text).forEach((o) => assert.equal(checkAnswer(ex, o).correct, false, where));
            break;
          case 'match':
            assert.equal(checkAnswer(ex, ex.pairs).correct, true, where);
            break;
          default:
            assert.fail('unknown type ' + ex.type);
        }
      });
    }
  });
}

test('14 or more courses, with the required languages', () => {
  const want = ['spanish', 'portuguese', 'french', 'german', 'italian', 'dutch', 'polish', 'russian', 'turkish', 'arabic', 'hindi', 'chinese', 'japanese', 'korean'];
  for (const w of want) assert.ok(courses[w], w + ' exists');
  assert.equal(courses.arabic.meta.dir, 'rtl');
});
