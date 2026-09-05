import React, { createContext, useContext, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
//  FLICKS — GLOBAL DATA CACHE CONTEXT
//  Ref-based so reading NEVER triggers React re-renders.
//  Only setter functions are exposed via context (stable callbacks).
// ═══════════════════════════════════════════════════════════════════════════

const STALE_MS = 1000 * 60 * 5; // 5 minutes

export type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

export type DataCacheState = {
  famePosts: CacheEntry<any[]> | null;
  fameFlicks: CacheEntry<any[]> | null;
  fameSuggestions: CacheEntry<any> | null;
  flicksFeed: CacheEntry<any[]> | null;
  circlePosts: Record<string, CacheEntry<any[]>>;
  circlePending: Record<string, CacheEntry<any[]>>;
  circleMembers: Record<string, CacheEntry<any[]>>;
  circleList: CacheEntry<any[]> | null;
  onlineUsers: CacheEntry<any[]> | null;
  reelPosts: CacheEntry<any[]> | null;
  myReels: CacheEntry<any[]> | null;
  frameRequests: CacheEntry<any[]> | null;
  profile: CacheEntry<any> | null;
};

const initialState: DataCacheState = {
  famePosts: null,
  fameFlicks: null,
  fameSuggestions: null,
  flicksFeed: null,
  circlePosts: {},
  circlePending: {},
  circleMembers: {},
  circleList: null,
  onlineUsers: null,
  reelPosts: null,
  myReels: null,
  frameRequests: null,
  profile: null,
};

interface DataCacheCtx {
  /** Direct ref — read without triggering re-renders */
  cacheRef: React.MutableRefObject<DataCacheState>;
  setCache: <K extends keyof DataCacheState>(key: K, value: DataCacheState[K] extends CacheEntry<infer T> ? CacheEntry<T> : DataCacheState[K]) => void;
  setCirclePosts: (circleId: string, entry: CacheEntry<any[]>) => void;
  setCirclePending: (circleId: string, entry: CacheEntry<any[]>) => void;
  setCircleMembers: (circleId: string, entry: CacheEntry<any[]>) => void;
  isStale: (key: keyof DataCacheState, circleId?: string) => boolean;
  hasData: (key: keyof DataCacheState, circleId?: string) => boolean;
  /** Resets all cached data — call on logout to prevent cross-session leaks. */
  clearCache: () => void;
}

const DataCacheContext = createContext<DataCacheCtx | null>(null);

export const useDataCache = () => {
  const ctx = useContext(DataCacheContext);
  if (!ctx) throw new Error("useDataCache must be inside DataCacheProvider");
  return ctx;
};

/**
 * Non-reactive cache reader — perfect for `useState(() => readCache(...))` initializers.
 * Does NOT subscribe to context changes, so calling it never causes a re-render.
 */
function readCache<T>(
  ctx: DataCacheCtx,
  key: keyof DataCacheState,
  circleId?: string
): { data: T | null; isStale: boolean; hasData: boolean } {
  const cache = ctx.cacheRef.current;
  let entry: CacheEntry<any> | null = null;

  if (key === "circlePosts" && circleId) entry = cache.circlePosts[circleId] ?? null;
  else if (key === "circlePending" && circleId) entry = cache.circlePending[circleId] ?? null;
  else if (key === "circleMembers" && circleId) entry = cache.circleMembers[circleId] ?? null;
  else {
    const raw = cache[key] as CacheEntry<any> | null | Record<string, any>;
    if (raw && "data" in raw && "fetchedAt" in raw) entry = raw as CacheEntry<any>;
  }

  const hasData = !!entry;
  const isStale = !entry || Date.now() - entry.fetchedAt > STALE_MS;
  return { data: entry?.data ?? null, isStale, hasData };
}

export const DataCacheProvider = ({ children }: { children: React.ReactNode }) => {
  const cacheRef = useRef<DataCacheState>({ ...initialState });

  const setCache = useCallback(<K extends keyof DataCacheState>(key: K, value: any) => {
    cacheRef.current = { ...cacheRef.current, [key]: value };
  }, []);

  const setCirclePosts = useCallback((circleId: string, entry: CacheEntry<any[]>) => {
    cacheRef.current = {
      ...cacheRef.current,
      circlePosts: { ...cacheRef.current.circlePosts, [circleId]: entry },
    };
  }, []);

  const setCirclePending = useCallback((circleId: string, entry: CacheEntry<any[]>) => {
    cacheRef.current = {
      ...cacheRef.current,
      circlePending: { ...cacheRef.current.circlePending, [circleId]: entry },
    };
  }, []);

  const setCircleMembers = useCallback((circleId: string, entry: CacheEntry<any[]>) => {
    cacheRef.current = {
      ...cacheRef.current,
      circleMembers: { ...cacheRef.current.circleMembers, [circleId]: entry },
    };
  }, []);

  const isStale = useCallback((key: keyof DataCacheState, circleId?: string) => {
    const cache = cacheRef.current;
    let entry: CacheEntry<any> | null = null;
    if (key === "circlePosts" && circleId) entry = cache.circlePosts[circleId] ?? null;
    else if (key === "circlePending" && circleId) entry = cache.circlePending[circleId] ?? null;
    else if (key === "circleMembers" && circleId) entry = cache.circleMembers[circleId] ?? null;
    else {
      const raw = cache[key] as any;
      if (raw && "fetchedAt" in raw) entry = raw;
    }
    return !entry || Date.now() - entry.fetchedAt > STALE_MS;
  }, []);

  const hasData = useCallback((key: keyof DataCacheState, circleId?: string) => {
    const cache = cacheRef.current;
    if (key === "circlePosts" && circleId) return !!cache.circlePosts[circleId];
    if (key === "circlePending" && circleId) return !!cache.circlePending[circleId];
    if (key === "circleMembers" && circleId) return !!cache.circleMembers[circleId];
    return !!cache[key];
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current = { ...initialState };
  }, []);

  // Stable context value — never changes, so consumers never re-render from context alone
  const value = React.useMemo<DataCacheCtx>(
    () => ({
      cacheRef,
      setCache,
      setCirclePosts,
      setCirclePending,
      setCircleMembers,
      isStale,
      hasData,
      clearCache,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  );
};
