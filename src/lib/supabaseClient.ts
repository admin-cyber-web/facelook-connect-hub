import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://yhcvbqeklahwvtytqtil.supabase.co";

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloY3ZicWVrbGFod3Z0eXRxdGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODc1MTIsImV4cCI6MjA5MDM2MzUxMn0.tihpQ1M8TzGxYseuov9iFm7Icb-WHNFahFnUX2lfhto";

// ── Safe storage adapter ────────────────────────────────────────────────────
// Tries localStorage first (real device / deployed app → full persistence).
// Falls back to an in-memory map when localStorage is blocked (e.g. Replit
// preview iframe) so the app still functions without crashing.
const memStore = new Map<string, string>();

function localStorageAvailable(): boolean {
  try {
    const k = "__flicks_ls_test__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const useLocalStorage = localStorageAvailable();

const safeStorage = {
  getItem(key: string): string | null {
    if (useLocalStorage) {
      try { return window.localStorage.getItem(key); } catch { /* fall */ }
    }
    return memStore.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    if (useLocalStorage) {
      try { window.localStorage.setItem(key, value); return; } catch { /* fall */ }
    }
    memStore.set(key, value);
  },
  removeItem(key: string): void {
    if (useLocalStorage) {
      try { window.localStorage.removeItem(key); return; } catch { /* fall */ }
    }
    memStore.delete(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: safeStorage,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: "flicks-auth-token",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
