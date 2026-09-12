// ── Global In-Memory Cache with 5-Minute TTL ──────────────────────────────
// Used to guard all auto-fetch useEffects so that switching tabs, navigating
// back, or re-mounting a component never fires a duplicate network request
// within the TTL window. Zero dependencies, zero React re-renders.

const TTL_MS = 1000 * 60 * 5; // 5 minutes
const MAX_ENTRIES = 200;

interface CacheEntry {
  data: unknown;
  at: number;
}

const store = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

function pruneStore(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    const ttl = (entry as any)._ttl ?? TTL_MS;
    if (now - entry.at > ttl) store.delete(key);
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
  const ttl = (entry as any)._ttl ?? TTL_MS;
  if (Date.now() - entry.at > ttl) {
    store.delete(key);
    return null;
  }
  store.delete(key);
  store.set(key, entry);
  return entry.data as T;
}

/** Stores data under key with current timestamp (optional custom TTL in ms). */
export function memSet(key: string, data: unknown, ttlMs?: number): void {
  const entry: CacheEntry = { data, at: Date.now() };
  if (ttlMs !== undefined) (entry as any)._ttl = ttlMs;
  store.delete(key);
  store.set(key, entry);
  pruneStore();
}

/** Removes a key (use after mutations so next fetch gets fresh data). */
export function memDel(key: string): void {
  store.delete(key);
  inFlight.delete(key);
}

/** Wipes every entry — call on logout to prevent cross-session data leaks. */
export function memClear(): void {
  store.clear();
  inFlight.clear();
}

/** Returns true if a key exists AND is still within TTL. */
export function memFresh(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  const ttl = (entry as any)._ttl ?? TTL_MS;
  if (Date.now() - entry.at > ttl) { store.delete(key); return false; }
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
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const request = fetchFn()
    .then((data) => {
      if (data !== null && data !== undefined) memSet(key, data);
      return data;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
