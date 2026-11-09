// Answer checking shared by the browser (instant feedback) and the server (authoritative re-grade).
// Pure functions only: no Node or browser APIs, safe to import anywhere.

const CONTRACTIONS = [
  ["i'm", 'i am'],
  ["you're", 'you are'],
  ["we're", 'we are'],
  ["they're", 'they are'],
  ["he's", 'he is'],
  ["she's", 'she is'],
  ["it's", 'it is'],
  ["that's", 'that is'],
  ["what's", 'what is'],
  ["where's", 'where is'],
  ["there's", 'there is'],
  ["how's", 'how is'],
  ["don't", 'do not'],
  ["doesn't", 'does not'],
  ["didn't", 'did not'],
  ["isn't", 'is not'],
  ["aren't", 'are not'],
  ["can't", 'cannot'],
  ["won't", 'will not'],
  ["i'd", 'i would'],
  ["i'll", 'i will'],
  ["let's", 'let us'],
  ["i've", 'i have'],
  ["you've", 'you have'],
].map(([from, to]) => [new RegExp('(^|[^a-z])' + from + '(?=$|[^a-z])', 'g'), '$1' + to]);

// Letters that do not decompose under NFD but should still match their plain form
// when accents are treated as optional (Polish ł, Turkish ı, German ß, ...).
const FOLD = { 'ł': 'l', 'ı': 'i', 'ß': 'ss', 'œ': 'oe', 'æ': 'ae', 'ø': 'o', 'đ': 'd' };
const FOLD_RE = /[łıßœæøđ]/g;
// Latin/Greek/Cyrillic combining diacritics (U+0300-036F). Marks of other scripts
// (Devanagari vowel signs, Japanese dakuten, Hangul jamo) are part of the letter and kept.
const DIACRITICS_RE = /[̀-ͯ]/g;
// Arabic short-vowel marks (harakat) and tatweel are optional in normal writing.
const ARABIC_MARKS_RE = /[ً-ْٰـ]/g;

// Lower-case, expand common English contractions, drop punctuation and collapse
// whitespace. Works for any script. With { accents: false } (the default) accents
// are stripped too, so "esta" matches "está". Hyphens count as spaces.
export function normalize(input, { accents = false } = {}) {
  let s = String(input == null ? '' : input).normalize('NFKC');
  s = s.replace(/İ/g, 'i'); // Turkish capital dotted I: avoid "i" + U+0307 after toLowerCase
  s = s.toLowerCase();
  s = s.normalize('NFD').replace(ARABIC_MARKS_RE, '');
  if (!accents) s = s.replace(DIACRITICS_RE, '').replace(FOLD_RE, (c) => FOLD[c]);
  s = s.normalize('NFC');
  s = s.replace(/[‘’`´ʼ]/g, "'");
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  s = s.replace(/'/g, '');
  s = s.replace(/-/g, ' ');
  s = s.replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const noSpaces = (s) => s.replace(/ /g, '');

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

// Returns { correct, typo, accent, best } where best is the canonical answer to show.
//  - exact match (ignoring case and punctuation)             -> correct
//  - same letters but different accents ("esta" vs "está")    -> correct + accent hint
//  - one typo in an answer of 6+ letters                      -> correct + typo hint
// looseSpaces: also ignore spaces (romanised answers like "nihao" vs "ni hao", or
// Chinese/Japanese text that has no spaces).
function matchText(response, answers, looseSpaces) {
  const best = answers[0];
  if (!normalize(response)) return { correct: false, typo: false, accent: false, best };
  const eq = (a, b) => a === b || (looseSpaces && noSpaces(a) === noSpaces(b));
  const strict = normalize(response, { accents: true });
  for (const a of answers) {
    if (eq(normalize(a, { accents: true }), strict)) return { correct: true, typo: false, accent: false, best: a };
  }
  const loose = normalize(response);
  for (const a of answers) {
    if (eq(normalize(a), loose)) return { correct: true, typo: false, accent: true, best: a };
  }
  // Forgive a single typo in longer answers.
  for (const a of answers) {
    const n = normalize(a);
    const r = looseSpaces ? noSpaces(loose) : loose;
    const m = looseSpaces ? noSpaces(n) : n;
    if ([...m].length >= 6 && levenshtein([...m], [...r]) <= 1) return { correct: true, typo: true, accent: false, best: a };
  }
  return { correct: false, typo: false, accent: false, best };
}

export function correctAnswerText(ex) {
  switch (ex.type) {
    case 'mc':
      return ex.answer;
    case 'tap':
      return ex.answer.join(ex.joiner === '' ? '' : ' ');
    case 'type':
      return ex.answers[0];
    case 'listen':
      return ex.options ? ex.text : ex.answers[0];
    case 'match':
      return ex.pairs.map((p) => p[0] + ' = ' + p[1]).join(', ');
    default:
      return '';
  }
}

const NO = (answer) => ({ correct: false, typo: false, accent: false, answer });

// response shapes:
//   mc: string (chosen option)        tap: string[] (tiles in order)
//   type / listen (typed): string     listen (choose): string (chosen option)
//   listen skipped (no voice): { skipped: true }
//   match: [[left, right], ...] (all pairs)
// Result: { correct, typo, accent, answer, skipped? }
export function checkAnswer(ex, response) {
  if (!ex) return NO('');
  const answer = correctAnswerText(ex);
  switch (ex.type) {
    case 'mc':
      return { ...NO(answer), correct: typeof response === 'string' && response === ex.answer };
    case 'tap': {
      if (!Array.isArray(response) || response.length === 0 || response.length > ex.tiles.length) return NO(answer);
      // Every tile used must exist in the tile bank (respecting multiplicity).
      const pool = ex.tiles.slice();
      for (const t of response) {
        const i = pool.indexOf(t);
        if (i === -1) return NO(answer);
        pool.splice(i, 1);
      }
      const r = normalize(response.join(' '));
      const options = [ex.answer.join(' ')].concat(ex.accepted || []);
      const ok = options.some((o) => normalize(o) === r || (ex.looseSpaces && noSpaces(normalize(o)) === noSpaces(r)));
      return { ...NO(answer), correct: ok };
    }
    case 'type': {
      if (typeof response !== 'string' || response.length > 300) return NO(answer);
      const m = matchText(response, ex.answers, !!ex.looseSpaces);
      return { correct: m.correct, typo: m.typo, accent: m.accent, answer: m.correct ? m.best : answer };
    }
    case 'listen': {
      if (response && typeof response === 'object' && response.skipped === true) {
        return { ...NO(answer), correct: true, skipped: true };
      }
      if (typeof response !== 'string' || response.length > 300) return NO(answer);
      if (ex.options) return { ...NO(answer), correct: response === ex.text };
      const m = matchText(response, ex.answers, !!ex.looseSpaces);
      return { correct: m.correct, typo: m.typo, accent: m.accent, answer: m.correct ? m.best : answer };
    }
    case 'match': {
      if (!Array.isArray(response) || response.length !== ex.pairs.length) return NO(answer);
      const want = new Set(ex.pairs.map((p) => p[0] + '\u0000' + p[1]));
      const got = new Set();
      for (const p of response) {
        if (!Array.isArray(p) || p.length !== 2) return NO(answer);
        got.add(String(p[0]) + '\u0000' + String(p[1]));
      }
      const ok = got.size === want.size && [...want].every((k) => got.has(k));
      return { ...NO(answer), correct: ok };
    }
    default:
      return NO(answer);
  }
}
