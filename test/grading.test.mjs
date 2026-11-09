// Run: node --test test/   (no dependencies; Node 18+)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, checkAnswer } from '../lib/grading.js';

const type = (answers, extra = {}) => ({ type: 'type', instruction: 'x', prompt: 'x', answers, words: [], ...extra });

test('normalize keeps non-Latin scripts', () => {
  assert.equal(normalize('Привет!'), 'привет');
  assert.equal(normalize('مرحبا؟'), 'مرحبا');
  assert.equal(normalize('नमस्ते।'), 'नमस्ते');
  assert.equal(normalize('你好！'), '你好');
  assert.equal(normalize('こんにちは。'), 'こんにちは');
  assert.equal(normalize('안녕하세요?'), '안녕하세요');
  assert.equal(normalize('が'), 'が'); // dakuten survives
});

test('case and punctuation are ignored', () => {
  const r = checkAnswer(type(['¿Dónde está el hotel?']), 'dónde está el hotel');
  assert.equal(r.correct, true);
  assert.equal(r.accent, false);
});

test('missing accents are accepted with a hint', () => {
  const r = checkAnswer(type(['¿Dónde está el hotel?']), 'donde esta el hotel');
  assert.equal(r.correct, true);
  assert.equal(r.accent, true);
  assert.equal(checkAnswer(type(['Dzień dobry']), 'dzien dobry').accent, true);
  assert.equal(checkAnswer(type(['Teşekkür ederim']), 'tesekkur ederim').accent, true);
  assert.equal(checkAnswer(type(['Gute Nacht']), 'gute nacht').accent, false);
  assert.equal(checkAnswer(type(['İyi geceler']), 'iyi geceler').accent, false);
});

test('one typo is forgiven in long answers only', () => {
  assert.equal(checkAnswer(type(['Good morning']), 'good mornin').typo, true);
  assert.equal(checkAnswer(type(['Hello']), 'helo').correct, false);
});

test('English contractions expand', () => {
  assert.equal(checkAnswer(type(['I am fine.']), "I'm fine").correct, true);
});

test('romanised answers ignore spaces when looseSpaces is set', () => {
  const ex = type(['你好', 'nǐ hǎo'], { looseSpaces: true });
  assert.equal(checkAnswer(ex, 'nihao').correct, true);
  assert.equal(checkAnswer(ex, 'ni hao').accent, true);
  assert.equal(checkAnswer(ex, '你好').correct, true);
});

test('Arabic vowel marks are optional', () => {
  assert.equal(checkAnswer(type(['شكرا']), 'شُكْرًا').correct, true);
});

test('tap checks tiles and order', () => {
  const ex = { type: 'tap', instruction: 'x', prompt: 'x', tiles: ['я', 'студент', 'кот'], answer: ['я', 'студент'], words: [] };
  assert.equal(checkAnswer(ex, ['я', 'студент']).correct, true);
  assert.equal(checkAnswer(ex, ['студент', 'я']).correct, false);
  assert.equal(checkAnswer(ex, ['я', 'не']).correct, false);
});

test('listen: typed, chosen and skipped', () => {
  const typed = { type: 'listen', instruction: 'x', text: 'Bonjour', answers: ['Bonjour'], words: [] };
  assert.equal(checkAnswer(typed, 'bonjour').correct, true);
  assert.equal(checkAnswer(typed, { skipped: true }).skipped, true);
  const chosen = { type: 'listen', instruction: 'x', text: 'ありがとう', options: ['ありがとう', 'はい'], words: [] };
  assert.equal(checkAnswer(chosen, 'ありがとう').correct, true);
  assert.equal(checkAnswer(chosen, 'はい').correct, false);
});

test('match needs every pair', () => {
  const ex = { type: 'match', instruction: 'x', pairs: [['a', '1'], ['b', '2']], words: [] };
  assert.equal(checkAnswer(ex, [['b', '2'], ['a', '1']]).correct, true);
  assert.equal(checkAnswer(ex, [['a', '2'], ['b', '1']]).correct, false);
});

test('Hindi nukta is optional (accent hint)', () => {
  const r = checkAnswer(type(['माफ़ कीजिए']), 'माफ कीजिए');
  assert.equal(r.correct, true);
  assert.equal(r.accent, true);
});
