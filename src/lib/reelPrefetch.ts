/**
 * Shared reel media prefetch cache (Flicks Reels + FameFeed).
 *
 * Warm-fetches video/audio blobs into memory (LRU) so reels start instantly
 * with zero buffering when their card mounts or the full-screen player opens
 * at that post. If a fetch fails (CORS/offline) consumers simply fall back to
 * the original remote URL — playback is never blocked by the cache.
 */

const MAX_ENTRIES = 14;

const objectUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const stamped = new Map<string, number>();
const listeners = new Set<() => void>();

let insertOrder = 0;

const evictIfNeeded = () => {
  while (objectUrls.size > MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestStamp = Number.POSITIVE_INFINITY;
    stamped.forEach((stamp, key) => {
      if (stamp < oldestStamp) {
        oldestStamp = stamp;
        oldestKey = key;
      }
    });
    if (!oldestKey) return;
    const victim = oldestKey as unknown as string;
    const victimUrl = objectUrls.get(victim);
    if (victimUrl) {
      try {
        URL.revokeObjectURL(victimUrl);
      } catch {
        /* already revoked */
      }
    }
    objectUrls.delete(victim);
    stamped.delete(victim);
  }
};

/** Warm the cache for one media URL. Duplicate / in-flight URLs are ignored. */
export function prefetchReelMedia(
  url: string | null | undefined,
  _priority: "high" | "normal" = "normal",
): void {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
  if (objectUrls.has(url) || inflight.has(url)) return;

  const run = async (): Promise<string | null> => {
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob || blob.size <= 0) return null;
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.set(url, objectUrl);
      stamped.set(url, ++insertOrder);
      evictIfNeeded();
      listeners.forEach((notify) => {
        try {
          notify();
        } catch {
          /* listener errors must not break the cache */
        }
      });
      return objectUrl;
    } catch {
      return null;
    } finally {
      inflight.delete(url);
    }
  };

  inflight.set(url, run());
}

/** Returns the cached blob URL for a remote URL, or null when not cached yet. */
export function getMediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return objectUrls.get(url) ?? null;
}

/** Subscribe to cache additions (e.g. to swap a pending <video src>). */
export function onMediaPrefetched(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
