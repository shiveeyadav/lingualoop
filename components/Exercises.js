// Exercise UIs. Each component owns its local UI state and reports the answer in the
// shape lib/grading.js expects via onChange(response). Components are re-mounted per
// exercise (keyed by the player), so local state resets automatically.
//
// `course` carries display settings: speechLang (BCP-47 for lang= and speech), dir
// ('rtl' for Arabic), romanization (e.g. 'pinyin'; empty for Latin scripts) and
// keyboard (extra letters to insert when typing).
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { speak, canSpeak } from '../lib/speech';

// Text in the language being learned, with its romanization underneath (if any).
export function TargetText({ text, roman, course, className = '' }) {
  return (
    <span className={'target ' + className}>
      <span lang={course.speechLang} dir={course.dir}>
        {text}
      </span>
      {roman ? (
        <span className="roman" lang={course.speechLang + '-Latn'}>
          {roman}
        </span>
      ) : null}
    </span>
  );
}

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

function Prompt({ ex, course, soundOn }) {
  const isTarget = ex.promptLang === 'target';
  useEffect(() => {
    if (isTarget && soundOn) speak(ex.prompt, course.speechLang);
  }, [isTarget, soundOn, ex.prompt, course.speechLang]);
  return (
    <div className="ex-prompt">
      {isTarget ? <SpeakButton text={ex.prompt} lang={course.speechLang} /> : null}
      {isTarget ? (
        <TargetText text={ex.prompt} roman={ex.promptRoman} course={course} />
      ) : (
        <span lang="en">{ex.prompt}</span>
      )}
    </div>
  );
}

// Number keys 1-9 pick an option (ignored while typing in a field).
function useNumberKeys(options, pick, disabled) {
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    if (disabled) return undefined;
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) pickRef.current(options[n - 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, disabled]);
}

function OptionList({ options, romans, targetLang, course, choice, disabled, onPick, label }) {
  return (
    <div className="options" role="group" aria-label={label}>
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          className="option"
          aria-pressed={choice === opt}
          disabled={disabled}
          onClick={() => onPick(opt)}
        >
          <span className="key" aria-hidden="true">
            {i + 1}
          </span>
          {targetLang ? (
            <TargetText text={opt} roman={romans ? romans[i] : ''} course={course} />
          ) : (
            <span lang="en">{opt}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- multiple choice ----------

export function MultipleChoice({ ex, disabled, onChange, course, soundOn }) {
  const [choice, setChoice] = useState(null);
  const optionsAreTarget = ex.promptLang !== 'target';

  function pick(opt) {
    if (disabled) return;
    setChoice(opt);
    onChange(opt);
    if (optionsAreTarget && soundOn) speak(opt, course.speechLang);
  }
  useNumberKeys(ex.options, pick, disabled);

  return (
    <div>
      <Prompt ex={ex} course={course} soundOn={soundOn} />
      <OptionList
        options={ex.options}
        romans={ex.optionsRoman}
        targetLang={optionsAreTarget}
        course={course}
        choice={choice}
        disabled={disabled}
        onPick={pick}
        label="Answer options"
      />
    </div>
  );
}

// ---------- tap the words (word bank) ----------

export function TapWords({ ex, disabled, onChange, course, soundOn }) {
  const [picked, setPicked] = useState([]); // indexes into ex.tiles
  const tilesAreTarget = ex.promptLang !== 'target';
  const romans = tilesAreTarget ? ex.tilesRoman : null;
  const dir = tilesAreTarget ? course.dir : 'ltr';
  const lang = tilesAreTarget ? course.speechLang : 'en';

  function update(next) {
    setPicked(next);
    onChange(next.map((i) => ex.tiles[i]));
  }

  // Backspace removes the last tile (when focus is not in a text field).
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  useEffect(() => {
    if (disabled) return undefined;
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Backspace' && pickedRef.current.length) {
        e.preventDefault();
        update(pickedRef.current.slice(0, -1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // update only closes over stable values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function tileContent(i) {
    return (
      <>
        <span lang={lang}>{ex.tiles[i]}</span>
        {romans && romans[i] ? <span className="tile-roman">{romans[i]}</span> : null}
      </>
    );
  }

  return (
    <div>
      <Prompt ex={ex} course={course} soundOn={soundOn} />
      <div className="answer-area" aria-label="Your sentence" role="group" dir={dir}>
        {picked.length === 0 ? (
          <span className="muted small" dir="ltr">
            Tap the words below in order.
          </span>
        ) : null}
        {picked.map((ti, pos) => (
          <button
            key={ti}
            type="button"
            className="tile"
            disabled={disabled}
            aria-label={ex.tiles[ti] + (romans && romans[ti] ? ' (' + romans[ti] + ')' : '') + ', remove'}
            onClick={() => update(picked.filter((_, p) => p !== pos))}
          >
            {tileContent(ti)}
          </button>
        ))}
      </div>
      <div className="bank" role="group" aria-label="Word bank" dir={dir}>
        {ex.tiles.map((t, i) => {
          const used = picked.includes(i);
          return (
            <button
              key={i}
              type="button"
              className={'tile' + (used ? ' used' : '')}
              disabled={disabled || used}
              aria-hidden={used ? true : undefined}
              tabIndex={used ? -1 : undefined}
              onClick={() => {
                update(picked.concat(i));
                if (tilesAreTarget && soundOn) speak(t, course.speechLang, { rate: 1 });
              }}
            >
              {tileContent(i)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- typing (shared by "type" and typed "listen") ----------

function TypeBox({ value, setValue, disabled, lang, dir, placeholder, keyboard, label }) {
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
    return undefined;
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
        dir={dir || 'auto'}
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
      {keyboard && keyboard.length ? (
        <div className="row keyboard" role="group" aria-label="Insert a special letter">
          {keyboard.map((ch) => (
            <button key={ch} type="button" className="tile tile-key" disabled={disabled} onClick={() => insert(ch)}>
              {ch}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TypeTranslation({ ex, disabled, onChange, course, soundOn }) {
  const [value, setValue] = useState('');
  const toTarget = ex.promptLang === 'en';
  let placeholder = 'Type in English';
  if (toTarget) {
    placeholder = 'Type in ' + course.shortName;
    if (ex.romanAllowed && course.romanization) placeholder += ' (or ' + course.romanization + ')';
  }
  return (
    <div>
      <Prompt ex={ex} course={course} soundOn={soundOn} />
      <TypeBox
        value={value}
        setValue={(v) => {
          setValue(v);
          onChange(v);
        }}
        disabled={disabled}
        lang={toTarget ? course.speechLang : 'en'}
        dir={toTarget && !ex.romanAllowed ? course.dir : 'auto'}
        placeholder={placeholder}
        keyboard={toTarget ? course.keyboard : null}
        label="Your translation"
      />
    </div>
  );
}

// ---------- listening ----------

function useVoice(text, lang, onNoVoice) {
  const [voice, setVoice] = useState('checking'); // checking | yes | no
  const cb = useRef(onNoVoice);
  cb.current = onNoVoice;
  useEffect(() => {
    let alive = true;
    canSpeak(lang).then((ok) => {
      if (!alive) return;
      setVoice(ok ? 'yes' : 'no');
      if (ok) speak(text, lang);
      else cb.current();
    });
    return () => {
      alive = false;
    };
  }, [text, lang]);
  return voice;
}

function NoVoice({ course }) {
  return (
    <div className="alert alert-info" role="status">
      <p style={{ margin: 0 }}>
        This browser has no {course.shortName} voice, so this listening exercise is skipped (no heart lost). Press{' '}
        <strong>Check</strong> to continue.
      </p>
      <p className="small" style={{ margin: '6px 0 0' }}>
        To hear audio, add a {course.shortName} text-to-speech voice in your device&apos;s language settings, or try
        Chrome, Edge or Safari.
      </p>
    </div>
  );
}

function ListenControls({ ex, course, voice }) {
  return (
    <div className="listen-row">
      <SpeakButton text={ex.text} lang={course.speechLang} big label="Play again" />
      {voice === 'yes' ? (
        <button type="button" className="btn btn-secondary" onClick={() => speak(ex.text, course.speechLang, { rate: 0.6 })}>
          Slower
        </button>
      ) : null}
      {voice === 'checking' ? <span className="muted small">Loading audio…</span> : null}
    </div>
  );
}

function SkipListening({ disabled, voice, onChange }) {
  if (disabled || voice !== 'yes') return null;
  return (
    <p className="small" style={{ marginTop: 8 }}>
      <button type="button" className="btn-link" onClick={() => onChange({ skipped: true }, true)}>
        I can&apos;t listen right now
      </button>
    </p>
  );
}

export function ListenType({ ex, disabled, onChange, course }) {
  const [value, setValue] = useState('');
  const voice = useVoice(ex.text, course.speechLang, () => onChange({ skipped: true }));
  if (voice === 'no') return <NoVoice course={course} />;
  return (
    <div>
      <ListenControls ex={ex} course={course} voice={voice} />
      <TypeBox
        value={value}
        setValue={(v) => {
          setValue(v);
          onChange(v);
        }}
        disabled={disabled || voice !== 'yes'}
        lang={course.speechLang}
        dir={course.dir}
        placeholder="Type what you hear"
        keyboard={course.keyboard}
        label="What you heard"
      />
      <SkipListening disabled={disabled} voice={voice} onChange={onChange} />
    </div>
  );
}

export function ListenChoose({ ex, disabled, onChange, course }) {
  const [choice, setChoice] = useState(null);
  const voice = useVoice(ex.text, course.speechLang, () => onChange({ skipped: true }));
  function pick(opt) {
    if (disabled || voice !== 'yes') return;
    setChoice(opt);
    onChange(opt);
  }
  useNumberKeys(ex.options, pick, disabled || voice !== 'yes');
  if (voice === 'no') return <NoVoice course={course} />;
  return (
    <div>
      <ListenControls ex={ex} course={course} voice={voice} />
      <OptionList
        options={ex.options}
        romans={ex.optionsRoman}
        targetLang
        course={course}
        choice={choice}
        disabled={disabled || voice !== 'yes'}
        onPick={pick}
        label="What did you hear?"
      />
      <SkipListening disabled={disabled} voice={voice} onChange={onChange} />
    </div>
  );
}

function Listen(props) {
  return props.ex.options ? <ListenChoose {...props} /> : <ListenType {...props} />;
}

// ---------- match pairs ----------

export function MatchPairs({ ex, disabled, onChange, onMistake, course, soundOn, sfx }) {
  const order =
    Array.isArray(ex.rightOrder) && ex.rightOrder.length === ex.pairs.length ? ex.rightOrder : ex.pairs.map((_, i) => i);
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
      if (soundOn) speak(ex.pairs[l][0], course.speechLang);
      if (next.length === ex.pairs.length) {
        onChange(
          ex.pairs.map((p) => [p[0], p[1]]),
          true
        );
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
    if (soundOn) speak(ex.pairs[i][0], course.speechLang);
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
        <div className="match-col" role="group" aria-label={course.shortName + ' words'}>
          {ex.pairs.map((p, i) => (
            <button
              key={'l' + i}
              type="button"
              className={cls(i, 'l')}
              aria-pressed={left === i}
              disabled={disabled || matched.includes(i)}
              onClick={() => chooseLeft(i)}
            >
              <TargetText text={p[0]} roman={ex.romans ? ex.romans[i] : ''} course={course} />
            </button>
          ))}
        </div>
        <div className="match-col" role="group" aria-label="English meanings">
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

// Romanization of the correct answer, where the exercise has one (for feedback).
export function answerRoman(ex) {
  if (ex.type === 'mc' && ex.optionsRoman) return ex.optionsRoman[ex.options.indexOf(ex.answer)] || '';
  if (ex.type === 'listen') return ex.roman || '';
  if (ex.type === 'tap' && ex.tilesRoman) {
    const used = new Set();
    return ex.answer
      .map((tok) => {
        const i = ex.tiles.findIndex((t, k) => t === tok && !used.has(k));
        if (i === -1) return '';
        used.add(i);
        return ex.tilesRoman[i];
      })
      .join(' ');
  }
  return '';
}

// Short text describing an exercise, for the mistakes review.
export function promptText(ex) {
  switch (ex.type) {
    case 'listen':
      return ex.text + (ex.translation ? ' - "' + ex.translation + '"' : '');
    case 'match':
      return 'Match the pairs';
    default:
      return ex.prompt || '';
  }
}

export function responseText(ex, response) {
  if (response == null) return '';
  if (typeof response === 'string') return response;
  if (Array.isArray(response) && ex.type === 'tap') return response.join(ex.joiner === '' ? '' : ' ');
  return '';
}

export const EXERCISE_COMPONENTS = {
  mc: MultipleChoice,
  tap: TapWords,
  type: TypeTranslation,
  listen: Listen,
  match: MatchPairs,
};
