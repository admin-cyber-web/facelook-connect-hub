// ── Bounded in-memory cache with a short TTL ───────────────────────────────
// This cache is intentionally process-local: it is not persisted to disk and
// never runs a cleanup interval. Expired entries are removed opportunistically
// and the LRU cap prevents a long session from retaining unbounded data.

const TTL_MS = 1000 * 60 * 5; // 5 minutes
const MAX_ENTRIES = 64;
const MAX_ARRAY_ITEMS = 250;

interface CacheEntry {
  data: unknown;
  at: number;
  ttlMs: number;
}

const store = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

function boundValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS);
  if (!value || typeof value !== "object") return value;

  // Most entries are small arrays, but a few contain arrays under a named
  // property. Bound those too without deep-cloning arbitrary application data.
  const result: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const [key, child] of Object.entries(result)) {
    if (Array.isArray(child)) result[key] = child.slice(0, MAX_ARRAY_ITEMS);
  }
  return result;
}

function prune(now = Date.now()): void {
  for (const [key, entry] of store) {
    if (now - entry.at > entry.ttlMs) store.delete(key);
  }
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Returns cached data if still fresh, null otherwise. */
export function memGet<T = unknown>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.at > entry.ttlMs) {
    store.delete(key);
    return null;
  }
  // Touch the entry so the cap behaves as LRU rather than FIFO.
  store.delete(key);
  store.set(key, entry);
  return entry.data as T;
}

/** Stores data under key with current timestamp (optional custom TTL in ms). */
export function memSet(key: string, data: unknown, ttlMs?: number): void {
  store.delete(key);
  const entry: CacheEntry = {
    data: boundValue(data),
    at: Date.now(),
    ttlMs: ttlMs ?? TTL_MS,
  };
  store.set(key, entry);
  prune(entry.at);
}

/** Removes a key (use after mutations so next fetch gets fresh data). */
export function memDel(key: string): void {
  store.delete(key);
}

/** Wipes every entry — call on logout to prevent cross-session data leaks. */
export function memClear(): void {
  store.clear();
  inFlight.clear();
  cacheGeneration += 1;
}

/** Returns true if a key exists AND is still within TTL. */
export function memFresh(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() - entry.at > entry.ttlMs) { store.delete(key); return false; }
  return true;
}

/**
 * Cache-then-fetch: returns the cached value when fresh, otherwise calls
 * `fetchFn`, stores the result, and returns it.  Non-null/undefined values
 * are cached; null/undefined bypass the cache so the next call retries.
 */
export async function memGetOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const hit = memGet<T>(key);
  if (hit !== null) return hit;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const generation = cacheGeneration;
  const request = fetchFn()
    .then((data) => {
      if (
        generation === cacheGeneration &&
        data !== null &&
        data !== undefined
      ) {
        memSet(key, data);
      }
      return data;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}
