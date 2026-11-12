/**
 * Central API base-URL helper for Flicks India.
 *
 * Uses a relative path for same-origin requests on the web to avoid
 * 307 Temporary Redirects (and CORS header stripping) that occur when the
 * browser is on www.flicksindia.online vs flicksindia.online, or http vs https.
 *
 * The Capacitor Android APK loads bundled assets via Capacitor's local server
 * (`https://localhost`), which serves only static `dist/` files — it has no
 * `/api/*` backend. On localhost/Capacitor we fall back to the absolute
 * VITE_API_BASE_URL so API calls still reach the deployed Vercel backend.
 */
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "https://flicksindia.online"
).replace(/\/+$/, "");

/**
 * Build an API URL from a path (e.g. "/api/videos/status").
 *
 * On production web browsers this returns a relative path so the request stays
 * on the current origin — no cross-origin redirect, no CORS header stripping.
 * On Capacitor Android / localhost dev it returns the absolute configured URL.
 */
export function apiUrl(path: string): string {
  const cleanedPath = path.replace(/^\/+/, "");

  if (typeof window !== "undefined" && window.location.origin) {
    const origin = window.location.origin;
    // Capacitor Android / localhost dev: backend is not served from same origin
    if (
      origin === "http://localhost:5173" ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1")
    ) {
      return `${API_BASE_URL}/${cleanedPath}`;
    }
    // Production web: same-origin relative path — no 307, no CORS stripping
    return `/${cleanedPath}`;
  }

  // SSR fallback
  return `${API_BASE_URL}/${cleanedPath}`;
}
