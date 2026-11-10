/**
 * Sticker image local cache using IndexedDB.
 * Provides offline-first loading for BunnyCDN sticker pack images.
 *
 * Schema:
 *   - DB name: "flicks-sticker-cache"
 *   - Store name: "stickers"
 *   - Key: sticker URL (string)
 *   - Value: { url, blob, cachedAt }
 */

const DB_NAME = "flicks-sticker-cache";
const STORE_NAME = "stickers";
const DB_VERSION = 1;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "url" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Get a cached sticker blob by URL, or null if missing/expired. */
export async function getCachedSticker(url: string): Promise<string | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const entry: { url: string; blob: string; cachedAt: number } | undefined =
      await new Promise((resolve, reject) => {
        const getReq = store.get(url);
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => reject(getReq.error);
      });
    db.close();

    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null; // expired
    return entry.blob; // data URL
  } catch (err) {
    console.warn("[StickerCache] read error:", err);
    return null;
  }
}

/** Cache a sticker image blob (data URL) by URL. */
export async function setCachedSticker(url: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const putReq = store.put({ url, blob: dataUrl, cachedAt: Date.now() });
      putReq.onsuccess = () => resolve(putReq.result);
      putReq.onerror = () => reject(putReq.error);
    });
    db.close();
  } catch (err) {
    console.warn("[StickerCache] write error:", err);
  }
}

/** Fetch a sticker image from BunnyCDN, falling back to local cache. Returns a data URL. */
export async function fetchStickerImage(url: string): Promise<string> {
  // 1. Try local cache first
  const cached = await getCachedSticker(url);
  if (cached) return cached;

  // 2. Fetch from BunnyCDN
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    // 3. Cache for offline use (non-blocking)
    void setCachedSticker(url, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn("[StickerCache] fetch failed:", err);
    return url; // fallback to direct URL
  }
}

/** Preload a category's stickers into local cache. */
export async function preloadCategory(category: string, files: string[]): Promise<void> {
  const base = "https://flicksindiacdn.b-cdn.net";
  await Promise.allSettled(
    files.map((file) => {
      const url = `${base}/${category}/${file}`;
      return fetchStickerImage(url);
    })
  );
}
