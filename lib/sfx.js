// Tiny synthesised sound effects using the Web Audio API (no audio files).
// Client-only; silently does nothing when audio is unavailable.
let ctx = null;

function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch (_) {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, start, dur, type, gain) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = a.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playCorrect() {
  tone(587.33, 0, 0.14, 'triangle', 0.18); // D5
  tone(880, 0.1, 0.22, 'triangle', 0.16); // A5
}

export function playWrong() {
  tone(220, 0, 0.18, 'sawtooth', 0.06);
  tone(196, 0.12, 0.25, 'sawtooth', 0.05);
}

export function playComplete() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.25, 'triangle', 0.15));
}
