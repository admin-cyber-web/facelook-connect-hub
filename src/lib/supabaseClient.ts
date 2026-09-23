import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const memStore = new Map<string, string>();
const sessionMemStore = new Map<string, string>();

function storageAvailable(storage: Storage | undefined, key: string): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getStorage(type: "localStorage" | "sessionStorage"): Storage | undefined {
  try {
    return window[type];
  } catch {
    return undefined;
  }
}

function createSafeStorage(
  browserStorage: Storage | undefined,
  fallbackStore: Map<string, string>,
): Storage {
  return {
    get length() {
      return browserStorage?.length ?? fallbackStore.size;
    },
    clear() {
      if (browserStorage) {
        try {
          browserStorage.clear();
          return;
        } catch {
          void 0;
        }
      }
      fallbackStore.clear();
    },
    getItem(key: string): string | null {
      if (browserStorage) {
        try {
          return browserStorage.getItem(key);
        } catch {
          void 0;
        }
      }
      return fallbackStore.get(key) ?? null;
    },
    key(index: number): string | null {
      if (browserStorage) {
        try {
          return browserStorage.key(index);
        } catch {
          void 0;
        }
      }
      return Array.from(fallbackStore.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      if (browserStorage) {
        try {
          browserStorage.removeItem(key);
          return;
        } catch {
          void 0;
        }
      }
      fallbackStore.delete(key);
    },
    setItem(key: string, value: string): void {
      if (browserStorage) {
        try {
          browserStorage.setItem(key, value);
          return;
        } catch {
          void 0;
        }
      }
      fallbackStore.set(key, value);
    },
  };
}

const localStorageRef = getStorage("localStorage");
const sessionStorageRef = getStorage("sessionStorage");
const safeStorage = createSafeStorage(
  storageAvailable(localStorageRef, "__flicks_ls_probe__") ? localStorageRef : undefined,
  memStore,
);
const safeSessionStorage = createSafeStorage(
  storageAvailable(sessionStorageRef, "__flicks_ss_probe__") ? sessionStorageRef : undefined,
  sessionMemStore,
);

try {
  if (!storageAvailable(sessionStorageRef, "__flicks_ss_probe__")) {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: safeSessionStorage,
    });
  }
} catch {
  try {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: safeSessionStorage,
    });
  } catch {
    if (!("sessionStorage" in globalThis)) {
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: safeSessionStorage,
      });
    }
  }
}

// ── Token validation ─────────────────────────────────────────────────────────
/** Decode a JWT payload WITHOUT verification (safe, client-side). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Returns true if the token is structurally valid and not expired. */
export function isTokenValid(token: string | null): boolean {
  if (!token || typeof token !== "string") return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 > Date.now() + 60_000; // 1-min grace
}

/** Wipe every Supabase-related key from storage so the next load starts clean. */
export function flushSupabaseStorage(): void {
  try {
    safeStorage.removeItem("sb-" + supabaseUrl.split("//")[1].split(".")[0] + "-auth-token");
  } catch {
    void 0;
  }
  try {
    safeStorage.clear();
  } catch {
    void 0;
  }
}

// ── Safe client creation ────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: safeStorage,
    lock: async (_name, _acquireTimeout, fn) => fn(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// A hidden mobile WebView should not keep receiving the project's entire
// realtime stream. Channels reconnect automatically when the app returns.
if (typeof document !== "undefined") {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      supabase.realtime.disconnect();
    } else {
      supabase.realtime.connect();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);
}
