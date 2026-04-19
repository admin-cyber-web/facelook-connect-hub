import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://yhcvbqeklahwvtytqtil.supabase.co";

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloY3ZicWVrbGFod3Z0eXRxdGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODc1MTIsImV4cCI6MjA5MDM2MzUxMn0.tihpQ1M8TzGxYseuov9iFm7Icb-WHNFahFnUX2lfhto";

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
