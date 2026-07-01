// ── Global In-Memory Cache with 5-Minute TTL ──────────────────────────────
// Used to guard all auto-fetch useEffects so that switching tabs, navigating
// back, or re-mounting a component never fires a duplicate network request
// within the TTL window. Zero dependencies, zero React re-renders.

const TTL_MS = 1000 * 60 * 5; // 5 minutes

interface CacheEntry {
  data: unknown;
  at: number;
}

const store = new Map<string, CacheEntry>();

/** Returns cached data if still fresh, null otherwise. */
export function memGet<T = unknown>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

/** Stores data under key with current timestamp. */
export function memSet(key: string, data: unknown): void {
  store.set(key, { data, at: Date.now() });
}

/** Removes a key (use after mutations so next fetch gets fresh data). */
export function memDel(key: string): void {
  store.delete(key);
}

/** Wipes every entry — call on logout to prevent cross-session data leaks. */
export function memClear(): void {
  store.clear();
}

/** Returns true if a key exists AND is still within TTL. */
export function memFresh(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() - entry.at > TTL_MS) { store.delete(key); return false; }
  return true;
}
