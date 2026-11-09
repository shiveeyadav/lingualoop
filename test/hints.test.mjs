import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildHintIndex, segmentHints } from '../lib/hints.js';

const require = createRequire(import.meta.url);
const { hintWords, getCourse } = require('../lib/content.js');

const hinted = (segs) => segs.filter((s) => s.hint).map((s) => s.text + '=' + s.hint.e);
const joined = (segs) => segs.map((s) => s.text).join('');

test('French: multi-word and apostrophe words, punctuation kept outside', () => {
  const idx = buildHintIndex([{ forms: ['le pain', 'pain', 'du pain'], e: 'Bread' }, { forms: ["l'eau", 'eau', "de l'eau"], e: 'Water' }]);
  const segs = segmentHints("De l'eau et du pain, merci.", idx);
  assert.equal(joined(segs), "De l'eau et du pain, merci.");
  assert.deepEqual(hinted(segs), ["De l'eau=Water", 'du pain=Bread']);
});

test('Japanese: longest match without spaces', () => {
  const idx = buildHintIndex([{ forms: ['コーヒー'], e: 'Coffee' }, { forms: ['今日'], e: 'Today' }, { forms: ['今'], e: 'Now' }]);
  const segs = segmentHints('今日はコーヒーを飲みます。', idx, { noSpaces: true });
  assert.equal(joined(segs), '今日はコーヒーを飲みます。');
  assert.deepEqual(hinted(segs), ['今日=Today', 'コーヒー=Coffee']);
});

test('Korean: word + particle', () => {
  const idx = buildHintIndex([{ forms: ['커피'], e: 'Coffee' }, { forms: ['아침'], e: 'Morning' }]);
  const segs = segmentHints('아침에 커피를 마셔요.', idx, { particles: ['에', '를', '을'] });
  assert.deepEqual(hinted(segs), ['아침에=Morning', '커피를=Coffee']);
});

test('Arabic: word lookup', () => {
  const idx = buildHintIndex([{ forms: ['شكرا'], e: 'Thank you' }]);
  assert.deepEqual(hinted(segmentHints('أنا بخير، شكرا.', idx)), ['شكرا=Thank you']);
});

test('course hints grow along the path', () => {
  const c = getCourse('spanish');
  const first = hintWords('spanish', c.lessonOrder[0]);
  const all = hintWords('spanish');
  assert.ok(first.length >= 4 && all.length > first.length * 5);
});
