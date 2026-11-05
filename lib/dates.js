// UK calendar helpers. Streaks and leaderboards use the Europe/London date.
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// 'YYYY-MM-DD' for the given instant in Europe/London.
export function ukDate(d = new Date()) {
  const parts = {};
  for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;
  return parts.year + '-' + parts.month + '-' + parts.day;
}

function toUtc(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(dateStr, n) {
  const t = toUtc(dateStr);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// Monday of the UK week containing dateStr.
export function weekStart(dateStr) {
  const dow = toUtc(dateStr).getUTCDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(dateStr, -back);
}

// Streak shown to the user: still alive if they practised today or yesterday.
export function displayStreak(streak, lastActiveDate, today = ukDate()) {
  if (!lastActiveDate) return 0;
  if (lastActiveDate === today || lastActiveDate === addDays(today, -1)) return streak || 0;
  return 0;
}
