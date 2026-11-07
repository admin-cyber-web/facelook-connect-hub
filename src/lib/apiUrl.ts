/**
 * Central API base-URL helper for Flicks India.
 *
 * The Capacitor Android APK loads bundled assets via Capacitor's local server
 * (`https://localhost`), which serves only static `dist/` files — it has no
 * `/api/*` backend. Relative fetch URLs such as `/api/videos/status` therefore
 * resolve to the SPA's `index.html` fallback (HTML), causing JSON parse errors.
 *
 * All Bunny/video API calls must target the deployed Vercel backend, whose
 * origin is configured via VITE_API_BASE_URL (default: https://flicksindia.online).
 * Vercel already emits `Access-Control-Allow-Origin: *` on `/api/*`, so
 * cross-origin calls from the Android WebView are permitted.
 */
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "https://flicksindia.online"
).replace(/\/+$/, "");

/**
 * Build an absolute API URL from a path (e.g. "/api/videos/status").
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
}
