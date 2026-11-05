// Text-to-speech via the browser's built-in speechSynthesis. Client-only:
// every function checks for `window` so nothing runs during server rendering.

function synth() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
    return null;
  }
  return window.speechSynthesis;
}

function loadVoices(timeoutMs) {
  const s = synth();
  if (!s) return Promise.resolve([]);
  const now = s.getVoices();
  if (now && now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        s.removeEventListener('voiceschanged', finish);
      } catch (_) {
        // older browsers
      }
      resolve(s.getVoices() || []);
    };
    try {
      s.addEventListener('voiceschanged', finish);
    } catch (_) {
      // older browsers
    }
    setTimeout(finish, timeoutMs);
  });
}

// Best voice for a BCP-47 tag like 'es-ES' or 'pt-PT' (falls back to same language).
export async function findVoice(lang) {
  const voices = await loadVoices(1500);
  if (!voices.length) return null;
  const want = lang.toLowerCase().replace('_', '-');
  const base = want.split('-')[0];
  const norm = (v) => (v.lang || '').toLowerCase().replace('_', '-');
  return (
    voices.find((v) => norm(v) === want) ||
    voices.find((v) => norm(v).startsWith(base + '-') || norm(v) === base) ||
    null
  );
}

export async function canSpeak(lang) {
  if (!synth()) return false;
  return !!(await findVoice(lang));
}

export async function speak(text, lang, { rate = 0.9 } = {}) {
  const s = synth();
  if (!s || !text) return false;
  const voice = await findVoice(lang);
  if (!voice) return false;
  try {
    s.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || lang;
    u.rate = rate;
    s.speak(u);
    return true;
  } catch (_) {
    return false;
  }
}
