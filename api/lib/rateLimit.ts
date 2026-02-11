type RateLimitEntry = {
  count: number;
  windowStart: number;
};

export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 30;

const store = new Map<string, RateLimitEntry>();

const cleanupStaleEntries = (now: number) => {
  if (store.size < 500) return;

  const staleBefore = now - RATE_LIMIT_WINDOW_MS * 2;
  for (const [key, entry] of store.entries()) {
    if (entry.windowStart < staleBefore) {
      store.delete(key);
    }
  }
};

export const checkRateLimit = (
  key: string
): { allowed: boolean; retryAfterSeconds?: number } => {
  const now = Date.now();
  cleanupStaleEntries(now);

  const normalizedKey = String(key || 'unknown').trim() || 'unknown';
  const current = store.get(normalizedKey);

  if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
    store.set(normalizedKey, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (current.count < RATE_LIMIT_MAX_REQUESTS) {
    current.count += 1;
    store.set(normalizedKey, current);
    return { allowed: true };
  }

  const retryMs = current.windowStart + RATE_LIMIT_WINDOW_MS - now;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
  };
};

export const resetRateLimitStore = () => {
  store.clear();
};
