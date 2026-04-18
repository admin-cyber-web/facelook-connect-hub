import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://yhcvbqeklahwvtytqtil.supabase.co";

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloY3ZicWVrbGFod3Z0eXRxdGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODc1MTIsImV4cCI6MjA5MDM2MzUxMn0.tihpQ1M8TzGxYseuov9iFm7Icb-WHNFahFnUX2lfhto";

// ── Safe storage adapter ────────────────────────────────────────────────────
// In production / Android: localStorage is available → full session persistence
// across refreshes.
// In sandboxed iframes (Replit preview): localStorage is blocked → we fall
// back to an in-memory map so the app doesn't crash (session lasts for the
// tab, but not across hard refreshes in that iframe only).
const memStore = new Map<string, string>();

function localStorageAvailable(): boolean {
  try {
    const k = "__flicks_ls_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const useLs = localStorageAvailable();

const safeStorage = {
  getItem(key: string): string | null {
    if (useLs) {
      try { return window.localStorage.getItem(key); } catch { /* fall */ }
    }
    return memStore.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    if (useLs) {
      try { window.localStorage.setItem(key, value); return; } catch { /* fall */ }
    }
    memStore.set(key, value);
  },
  removeItem(key: string): void {
    if (useLs) {
      try { window.localStorage.removeItem(key); return; } catch { /* fall */ }
    }
    memStore.delete(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: safeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // ⚠️  Do NOT set storageKey here — keep Supabase's default
    // (sb-yhcvbqeklahwvtytqtil-auth-token) so existing sessions are found.
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
