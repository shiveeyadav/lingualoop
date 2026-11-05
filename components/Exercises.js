// Exercise UIs. Each component owns its local UI state and reports the answer in the
// shape lib/grading.js expects via onChange(response). Components are re-mounted per
// exercise (keyed by the player), so local state resets automatically.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { speak, canSpeak } from '../lib/speech';

const ACCENT_KEYS = {
  'es-ES': ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'],
  'pt-PT': ['á', 'à', 'â', 'ã', 'ç', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú'],
};

export function SpeakButton({ text, lang, big = false, label }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    canSpeak(lang).then((ok) => {
      if (alive) setAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, [lang]);
  if (!available) return null;
  return (
    <button
      type="button"
      className={'speak-btn' + (big ? ' speak-big' : '')}
      onClick={() => speak(text, lang)}
      aria-label={label || 'Play audio'}
    >
      <Icon name="speaker" />
    </button>
  );
}

function Prompt({ ex, speechLang, soundOn }) {
  const isTarget = ex.promptLang === 'target';
  useEffect(() => {
    if (isTarget && soundOn) speak(ex.prompt, speechLang);
  }, [isTarget, soundOn, ex.prompt, speechLang]);
  return (
    <div className="ex-prompt">
      {isTarget ? <SpeakButton text={ex.prompt} lang={speechLang} /> : null}
      <span lang={isTarget ? speechLang : 'en'}>{ex.prompt}</span>
    </div>
  );
}

// ---------- multiple choice ----------

export function MultipleChoice({ ex, disabled, onChange, speechLang, soundOn }) {
  const [choice, setChoice] = useState(null);
  const optionLang = ex.promptLang === 'target' ? 'en' : speechLang;

  function pick(opt) {
    if (disabled) return;
    setChoice(opt);
    onChange(opt);
  }

  // Number keys 1-9 pick an option (ignored while typing in a field).
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= ex.options.length) pickRef.current(ex.options[n - 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ex.options]);

  return (
    <div>
      <Prompt ex={ex} speechLang={speechLang} soundOn={soundOn} />
      <div className="options" role="group" aria-label="Answer options">
        {ex.options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            className="option"
            aria-pressed={choice === opt}
            disabled={disabled}
            onClick={() => pick(opt)}
            lang={optionLang}
          >
            <span className="key" aria-hidden="true">
              {i + 1}
            </span>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- tap the words ----------

export function TapWords({ ex, disabled, onChange, speechLang, soundOn }) {
  const [picked, setPicked] = useState([]); // indexes into ex.tiles
  const tilesLang = ex.promptLang === 'target' ? 'en' : speechLang;

  function update(next) {
    setPicked(next);
    onChange(next.map((i) => ex.tiles[i]));
  }

  return (
    <div>
      <Prompt ex={ex} speechLang={speechLang} soundOn={soundOn} />
      <div className="answer-area" aria-label="Your sentence" role="group">
        {picked.length === 0 ? <span className="muted small">Tap the words below in order.</span> : null}
        {picked.map((ti, pos) => (
          <button
            key={ti}
            type="button"
            className="tile"
            disabled={disabled}
            lang={tilesLang}
            aria-label={ex.tiles[ti] + ' (remove)'}
            onClick={() => update(picked.filter((_, p) => p !== pos))}
          >
            {ex.tiles[ti]}
          </button>
        ))}
      </div>
      <div className="bank" role="group" aria-label="Word bank">
        {ex.tiles.map((t, i) => {
          const used = picked.includes(i);
          return (
            <button
              key={i}
              type="button"
              className={'tile' + (used ? ' used' : '')}
              disabled={disabled || used}
              lang={tilesLang}
              aria-hidden={used ? true : undefined}
              tabIndex={used ? -1 : undefined}
              onClick={() => update(picked.concat(i))}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- typing (shared by "type" and "listen") ----------

function TypeBox({ value, setValue, disabled, lang, placeholder, accents, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && !disabled) ref.current.focus();
  }, [disabled]);

  function insert(ch) {
    const el = ref.current;
    if (!el) return setValue(value + ch);
    const start = el.selectionStart == null ? value.length : el.selectionStart;
    const end = el.selectionEnd == null ? value.length : el.selectionEnd;
    const next = value.slice(0, start) + ch + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  }

  return (
    <div>
      <label className="sr-only" htmlFor="answer-input">
        {label}
      </label>
      <textarea
        id="answer-input"
        ref={ref}
        className="answer-input"
        value={value}
        lang={lang}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={300}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const form = e.currentTarget.form;
            if (form) {
              if (typeof form.requestSubmit === 'function') form.requestSubmit();
              else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
          }
        }}
      />
      {accents && accents.length ? (
        <div className="row" style={{ marginTop: 8 }} role="group" aria-label="Insert accented letter">
          {accents.map((ch) => (
            <button key={ch} type="button" className="tile" disabled={disabled} onClick={() => insert(ch)}>
              {ch}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TypeTranslation({ ex, disabled, onChange, speechLang, soundOn }) {
  const [value, setValue] = useState('');
  const toTarget = ex.promptLang === 'en';
  return (
    <div>
      <Prompt ex={ex} speechLang={speechLang} soundOn={soundOn} />
      <TypeBox
        value={value}
        setValue={(v) => {
          setValue(v);
          onChange(v);
        }}
        disabled={disabled}
        lang={toTarget ? speechLang : 'en'}
        placeholder={toTarget ? 'Type in the language you are learning' : 'Type in English'}
        accents={toTarget ? ACCENT_KEYS[speechLang] : null}
        label="Your translation"
      />
    </div>
  );
}

export function ListenType({ ex, disabled, onChange, speechLang, soundOn }) {
  const [value, setValue] = useState('');
  const [voice, setVoice] = useState('checking'); // checking | yes | no

  useEffect(() => {
    let alive = true;
    canSpeak(speechLang).then((ok) => {
      if (!alive) return;
      setVoice(ok ? 'yes' : 'no');
      if (ok) speak(ex.text, speechLang);
      else onChange({ skipped: true });
    });
    return () => {
      alive = false;
    };
    // onChange is stable for the life of this exercise
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.text, speechLang]);

  if (voice === 'no') {
    return (
      <div>
        <div className="alert alert-info" role="status">
          Audio is not available in this browser, so this listening exercise will be skipped. Press Check to
          continue.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="listen-row">
        <SpeakButton text={ex.text} lang={speechLang} big label="Play the sentence" />
        {voice === 'yes' ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => speak(ex.text, speechLang, { rate: 0.6 })}
          >
            Slower
          </button>
        ) : null}
      </div>
      <TypeBox
        value={value}
        setValue={(v) => {
          setValue(v);
          onChange(v);
        }}
        disabled={disabled || voice !== 'yes'}
        lang={speechLang}
        placeholder="Type what you hear"
        accents={ACCENT_KEYS[speechLang]}
        label="What you heard"
      />
      {!disabled && voice === 'yes' ? (
        <p className="small" style={{ marginTop: 8 }}>
          <button type="button" className="btn-link" onClick={() => onChange({ skipped: true }, true)}>
            I can&apos;t listen right now
          </button>
        </p>
      ) : null}
    </div>
  );
}

// ---------- match pairs ----------

export function MatchPairs({ ex, disabled, onChange, onMistake, speechLang, soundOn, sfx }) {
  const order = Array.isArray(ex.rightOrder) && ex.rightOrder.length === ex.pairs.length
    ? ex.rightOrder
    : ex.pairs.map((_, i) => i);
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [matched, setMatched] = useState([]); // pair indexes
  const [wrong, setWrong] = useState(null); // { l, r }

  function attempt(l, r) {
    if (l === r) {
      const next = matched.concat(l);
      setMatched(next);
      setLeft(null);
      setRight(null);
      if (soundOn) speak(ex.pairs[l][0], speechLang);
      if (next.length === ex.pairs.length) {
        onChange(ex.pairs.map((p) => [p[0], p[1]]), true);
      }
    } else {
      setWrong({ l, r });
      setLeft(null);
      setRight(null);
      if (sfx) sfx('wrong');
      onMistake();
      setTimeout(() => setWrong(null), 500);
    }
  }

  function chooseLeft(i) {
    if (disabled || matched.includes(i)) return;
    if (right !== null) attempt(i, right);
    else setLeft(left === i ? null : i);
  }

  function chooseRight(i) {
    if (disabled || matched.includes(i)) return;
    if (left !== null) attempt(left, i);
    else setRight(right === i ? null : i);
  }

  function cls(i, side) {
    if (matched.includes(i)) return 'match-btn matched';
    if (wrong && wrong[side] === i) return 'match-btn wrong';
    return 'match-btn';
  }

  return (
    <div>
      <p className="muted small" aria-live="polite">
        {matched.length} of {ex.pairs.length} pairs matched
      </p>
      <div className="match-grid">
        <div className="match-col" role="group" aria-label="Words">
          {ex.pairs.map((p, i) => (
            <button
              key={'l' + i}
              type="button"
              className={cls(i, 'l')}
              lang={speechLang}
              aria-pressed={left === i}
              disabled={disabled || matched.includes(i)}
              onClick={() => chooseLeft(i)}
            >
              {p[0]}
            </button>
          ))}
        </div>
        <div className="match-col" role="group" aria-label="Meanings">
          {order.map((i) => (
            <button
              key={'r' + i}
              type="button"
              className={cls(i, 'r')}
              lang="en"
              aria-pressed={right === i}
              disabled={disabled || matched.includes(i)}
              onClick={() => chooseRight(i)}
            >
              {ex.pairs[i][1]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function isReady(ex, response) {
  if (response == null) return false;
  switch (ex.type) {
    case 'mc':
      return typeof response === 'string';
    case 'tap':
      return Array.isArray(response) && response.length > 0;
    case 'type':
      return typeof response === 'string' && response.trim().length > 0;
    case 'listen':
      return (typeof response === 'string' && response.trim().length > 0) || response.skipped === true;
    case 'match':
      return Array.isArray(response) && response.length === ex.pairs.length;
    default:
      return false;
  }
}

export const EXERCISE_COMPONENTS = {
  mc: MultipleChoice,
  tap: TapWords,
  type: TypeTranslation,
  listen: ListenType,
  match: MatchPairs,
};
