type RateLimitEntry = {
  count: number;
  windowStart: number;
  windowMs: number;
};

export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 30;

const store = new Map<string, RateLimitEntry>();

export type RateLimitOptions = {
  namespace?: string;
  windowMs?: number;
  maxRequests?: number;
};

const cleanupStaleEntries = (now: number) => {
  if (store.size < 500) return;

  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > entry.windowMs * 2) {
      store.delete(key);
    }
  }
};

export const checkRateLimit = (
  key: string,
  options: RateLimitOptions = {}
): { allowed: boolean; retryAfterSeconds?: number } => {
  const now = Date.now();
  cleanupStaleEntries(now);

  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? RATE_LIMIT_MAX_REQUESTS;
  const namespace = (options.namespace || 'default').trim() || 'default';
  const normalizedKey = String(key || 'unknown').trim() || 'unknown';
  const storeKey = `${namespace}:${normalizedKey}`;
  const current = store.get(storeKey);

  if (!current || now - current.windowStart >= windowMs) {
    store.set(storeKey, { count: 1, windowStart: now, windowMs });
    return { allowed: true };
  }

  if (current.count < maxRequests) {
    current.count += 1;
    store.set(storeKey, current);
    return { allowed: true };
  }

  const retryMs = current.windowStart + windowMs - now;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
  };
};

export const resetRateLimitStore = () => {
  store.clear();
};
