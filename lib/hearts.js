// Heart refill maths (pure). Hearts regenerate one per HEART_REFILL_MINUTES.
import { MAX_HEARTS, HEART_REFILL_MINUTES } from './constants';

const REFILL_MS = HEART_REFILL_MINUTES * 60 * 1000;

// Returns { hearts, nextAt (ms epoch or null), anchor (ms epoch to store as hearts_updated_at) }
export function effectiveHearts(storedHearts, updatedAt, now = Date.now()) {
  const updated = new Date(updatedAt).getTime() || now;
  if (storedHearts >= MAX_HEARTS) return { hearts: MAX_HEARTS, nextAt: null, anchor: now };
  const gained = Math.max(0, Math.floor((now - updated) / REFILL_MS));
  const hearts = Math.min(MAX_HEARTS, storedHearts + gained);
  if (hearts >= MAX_HEARTS) return { hearts, nextAt: null, anchor: now };
  // Keep partial progress towards the next heart.
  const anchor = updated + gained * REFILL_MS;
  return { hearts, nextAt: anchor + REFILL_MS, anchor };
}

// New stored state after changing hearts by delta (negative = lose).
export function applyHeartDelta(storedHearts, updatedAt, delta, now = Date.now()) {
  const cur = effectiveHearts(storedHearts, updatedAt, now);
  const next = Math.max(0, Math.min(MAX_HEARTS, cur.hearts + delta));
  // When dropping from full, the refill clock starts now.
  const anchor = cur.hearts >= MAX_HEARTS ? now : cur.anchor;
  return { hearts: next, updatedAt: new Date(next >= MAX_HEARTS ? now : anchor) };
}
