// Tiny in-memory fixed-window rate limiter (per process). Good enough for a
// single-container MVP; use Redis or the proxy for multi-instance deployments.
const buckets = new Map();

export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    }
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
