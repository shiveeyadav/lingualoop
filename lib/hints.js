// Tap-a-word hints (pure; used in the browser, unit-tested in Node).
// Splits target-language text into segments and attaches the English meaning of
// words the learner has been taught, like Duolingo's hover hints.

function isWordChar(ch) {
  return /[\p{L}\p{M}\p{N}'’]/u.test(ch);
}

export function hintKey(s) {
  return String(s || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^\p{L}\p{M}\p{N}'\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// words: [{ forms: [..], e, r }] -> { map: Map(key -> { e, r }), maxWords, maxChars }
export function buildHintIndex(words) {
  const map = new Map();
  let maxWords = 1;
  let maxChars = 1;
  for (const w of words || []) {
    for (const f of w.forms || []) {
      const k = hintKey(f);
      if (!k || map.has(k)) continue;
      map.set(k, { e: w.e, r: w.r || '' });
      maxWords = Math.max(maxWords, k.split(' ').length);
      maxChars = Math.max(maxChars, Array.from(k.replace(/ /g, '')).length);
    }
  }
  return { map, maxWords: Math.min(maxWords, 4), maxChars: Math.min(maxChars, 8) };
}

// Returns [{ text, hint? }] covering the whole input text in order.
export function segmentHints(text, index, { noSpaces = false, particles = [] } = {}) {
  const src = String(text || '');
  if (!index || !index.map.size || !src) return [{ text: src }];
  return noSpaces ? segmentChars(src, index) : segmentWords(src, index, particles);
}

// Chinese / Japanese: longest known word starting at each character.
function segmentChars(src, index) {
  const chars = Array.from(src);
  const out = [];
  let plain = '';
  let i = 0;
  while (i < chars.length) {
    let found = null;
    if (isWordChar(chars[i])) {
      for (let n = Math.min(index.maxChars, chars.length - i); n >= 1; n--) {
        const piece = chars.slice(i, i + n).join('');
        const hit = index.map.get(hintKey(piece));
        if (hit && hintKey(piece) === piece.toLowerCase()) {
          found = { text: piece, hint: hit, n };
          break;
        }
      }
    }
    if (found) {
      if (plain) out.push({ text: plain });
      plain = '';
      out.push({ text: found.text, hint: found.hint });
      i += found.n;
    } else {
      plain += chars[i];
      i += 1;
    }
  }
  if (plain) out.push({ text: plain });
  return out;
}

// Space-separated languages: longest run of up to maxWords words, then a single word,
// then (Korean) a word made of a known word plus a grammar particle.
function segmentWords(src, index, particles) {
  const parts = src.split(/(\s+)/); // words at even indexes, spaces at odd
  const out = [];
  const push = (seg) => {
    const last = out[out.length - 1];
    if (!seg.hint && last && !last.hint) last.text += seg.text;
    else out.push(seg);
  };
  const ps = particles.slice().sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < parts.length) {
    if (i % 2 === 1 || !parts[i]) {
      push({ text: parts[i] });
      i += 1;
      continue;
    }
    let done = false;
    for (let n = index.maxWords; n >= 1 && !done; n--) {
      const end = i + 2 * (n - 1);
      if (end >= parts.length) continue;
      const span = parts.slice(i, end + 1).join('');
      const hit = index.map.get(hintKey(span));
      if (hit) {
        // keep leading/trailing punctuation outside the hint
        const m = span.match(/^([^\p{L}\p{M}\p{N}]*)(.*?)([^\p{L}\p{M}\p{N}']*)$/u);
        if (m[1]) push({ text: m[1] });
        push({ text: m[2], hint: hit });
        if (m[3]) push({ text: m[3] });
        i = end + 1;
        done = true;
      }
    }
    if (done) continue;
    const word = parts[i];
    const core = hintKey(word);
    let hit = null;
    for (const p of ps) {
      if (core.length > p.length && core.endsWith(p)) {
        hit = index.map.get(core.slice(0, -p.length));
        if (hit) break;
      }
    }
    if (hit) {
      const m = word.match(/^([^\p{L}\p{M}\p{N}]*)(.*?)([^\p{L}\p{M}\p{N}']*)$/u);
      if (m[1]) push({ text: m[1] });
      push({ text: m[2], hint: hit });
      if (m[3]) push({ text: m[3] });
    } else {
      push({ text: word });
    }
    i += 1;
  }
  return out;
}
