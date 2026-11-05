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

// Lower-case, strip accents (so "esta" matches "está"), expand common English
// contractions, drop punctuation and collapse whitespace. Hyphens count as spaces.
export function normalize(input) {
  let s = String(input == null ? '' : input);
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  s = s.replace(/[‘’`´]/g, "'");
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  s = s.replace(/'/g, '');
  s = s.replace(/-/g, ' ');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

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

// Returns { correct, typo, best } where best is the canonical answer to show.
function matchText(response, answers) {
  const r = normalize(response);
  const best = answers[0];
  if (!r) return { correct: false, typo: false, best };
  for (const a of answers) {
    if (normalize(a) === r) return { correct: true, typo: false, best: a };
  }
  // Forgive a single typo in longer answers.
  for (const a of answers) {
    const n = normalize(a);
    if (n.length >= 6 && levenshtein(n, r) <= 1) return { correct: true, typo: true, best: a };
  }
  return { correct: false, typo: false, best };
}

export function correctAnswerText(ex) {
  switch (ex.type) {
    case 'mc':
      return ex.answer;
    case 'tap':
      return ex.answer.join(' ');
    case 'type':
    case 'listen':
      return ex.answers[0];
    case 'match':
      return ex.pairs.map((p) => p[0] + ' = ' + p[1]).join(', ');
    default:
      return '';
  }
}

// response shapes:
//   mc: string (chosen option)        tap: string[] (tiles in order)
//   type/listen: string               listen skipped: { skipped: true }
//   match: [[left, right], ...] (all pairs)
export function checkAnswer(ex, response) {
  if (!ex) return { correct: false, typo: false, answer: '' };
  const answer = correctAnswerText(ex);
  switch (ex.type) {
    case 'mc':
      return { correct: typeof response === 'string' && response === ex.answer, typo: false, answer };
    case 'tap': {
      if (!Array.isArray(response) || response.length === 0 || response.length > ex.tiles.length) {
        return { correct: false, typo: false, answer };
      }
      // Every tile used must exist in the tile bank (respecting multiplicity).
      const pool = ex.tiles.slice();
      for (const t of response) {
        const i = pool.indexOf(t);
        if (i === -1) return { correct: false, typo: false, answer };
        pool.splice(i, 1);
      }
      const r = normalize(response.join(' '));
      const options = [ex.answer.join(' ')].concat(ex.accepted || []);
      const ok = options.some((o) => normalize(o) === r);
      return { correct: ok, typo: false, answer };
    }
    case 'type': {
      if (typeof response !== 'string' || response.length > 300) return { correct: false, typo: false, answer };
      const m = matchText(response, ex.answers);
      return { correct: m.correct, typo: m.typo, answer: m.correct ? m.best : answer };
    }
    case 'listen': {
      if (response && typeof response === 'object' && response.skipped === true) {
        return { correct: true, typo: false, skipped: true, answer };
      }
      if (typeof response !== 'string' || response.length > 300) return { correct: false, typo: false, answer };
      const m = matchText(response, ex.answers);
      return { correct: m.correct, typo: m.typo, answer: m.correct ? m.best : answer };
    }
    case 'match': {
      if (!Array.isArray(response) || response.length !== ex.pairs.length) return { correct: false, typo: false, answer };
      const want = new Set(ex.pairs.map((p) => p[0] + '\u0000' + p[1]));
      const got = new Set();
      for (const p of response) {
        if (!Array.isArray(p) || p.length !== 2) return { correct: false, typo: false, answer };
        got.add(String(p[0]) + '\u0000' + String(p[1]));
      }
      const ok = got.size === want.size && [...want].every((k) => got.has(k));
      return { correct: ok, typo: false, answer };
    }
    default:
      return { correct: false, typo: false, answer };
  }
}
