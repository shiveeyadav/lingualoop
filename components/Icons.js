// Original inline SVG icons (stroke-based, inherit currentColor). Decorative by default.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

const PATHS = {
  wave: (
    <>
      <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M2 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  hash: (
    <>
      <path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18" />
    </>
  ),
  cup: (
    <>
      <path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z" />
      <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 2v3M12 2v3" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  home: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  train: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 11h14M9 21l-2-4M15 21l2-4" />
      <circle cx="9" cy="14" r="0.5" />
      <circle cx="15" cy="14" r="0.5" />
    </>
  ),
  fork: (
    <>
      <path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11" />
      <path d="M17 3c-2 2-2 6 0 8v10" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  flame: <path d="M12 21c-4 0-7-3-7-7 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-4 3 3 4 5 4 8 0 4-3 7-7 7z" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  crown: <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />,
  speaker: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6v4H9z" />
    </>
  ),
};

export function Icon({ name, className, title }) {
  const content = PATHS[name] || PATHS.star;
  const props = { ...base, className };
  if (title) {
    props['aria-hidden'] = undefined;
    props.role = 'img';
  }
  return (
    <svg {...props}>
      {title ? <title>{title}</title> : null}
      {content}
    </svg>
  );
}

// LinguaLoop mark: two interlocking rings (an original loop symbol).
export function BrandMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="15" cy="20" r="10" fill="none" stroke="#4338ca" strokeWidth="5" />
      <circle cx="25" cy="20" r="10" fill="none" stroke="#d97706" strokeWidth="5" />
      <path d="M22.1 11.4a10 10 0 0 1 0 17.2" fill="none" stroke="#4338ca" strokeWidth="5" />
    </svg>
  );
}

// Friendly abstract illustration for hero and completion screens (no mascot).
export function LoopArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 160" aria-hidden="true" focusable="false">
      <circle cx="80" cy="80" r="74" fill="#e8e6fb" />
      <circle cx="62" cy="80" r="30" fill="none" stroke="#4338ca" strokeWidth="12" />
      <circle cx="98" cy="80" r="30" fill="none" stroke="#d97706" strokeWidth="12" />
      <path d="M88.6 51.6a30 30 0 0 1 0 56.8" fill="none" stroke="#4338ca" strokeWidth="12" />
      <circle cx="122" cy="38" r="6" fill="#e0245e" />
      <circle cx="36" cy="124" r="5" fill="#0b7a5c" />
      <circle cx="132" cy="118" r="4" fill="#4338ca" />
    </svg>
  );
}
