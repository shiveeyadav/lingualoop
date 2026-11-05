// Prepares exercises for the player on the server (pure). Randomness happens here,
// not in the browser, so server-rendered HTML and client hydration always agree.

function shuffledIndexes(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Avoid leaving every pair lined up opposite its answer.
  if (n > 1 && a.every((v, i) => v === i)) a.push(a.shift());
  return a;
}

export function prepareExercise(ex) {
  const copy = JSON.parse(JSON.stringify(ex));
  if (copy.type === 'match') copy.rightOrder = shuffledIndexes(copy.pairs.length);
  return copy;
}
