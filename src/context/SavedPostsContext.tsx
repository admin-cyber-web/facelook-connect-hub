import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";

type SavedPostsContextValue = {
  savedPostIds: Set<string>;
  loading: boolean;
  error: string | null;
  isSaved: (postId: string) => boolean;
  isPending: (postId: string) => boolean;
  toggleSaved: (postId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const SavedPostsContext = createContext<SavedPostsContextValue | null>(null);
const SAVE_PAGE_SIZE = 500;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Saved items could not be loaded.";
}

export function SavedPostsProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [pendingPostIds, setPendingPostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const savedPostIdsRef = useRef(savedPostIds);
  const pendingPostIdsRef = useRef(pendingPostIds);
  const loadSequence = useRef(0);

  const replaceSavedPostIds = useCallback((next: Set<string>) => {
    savedPostIdsRef.current = next;
    setSavedPostIds(next);
  }, []);

  const replacePendingPostIds = useCallback((next: Set<string>) => {
    pendingPostIdsRef.current = next;
    setPendingPostIds(next);
  }, []);

  const refresh = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!userId) {
      replaceSavedPostIds(new Set());
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const ids = new Set<string>();
      let from = 0;
      while (true) {
        const { data, error: queryError } = await supabase
          .from("post_saves")
          .select("post_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(from, from + SAVE_PAGE_SIZE - 1);

        if (queryError) throw queryError;
        if (sequence !== loadSequence.current) return;

        const rows = data ?? [];
        rows.forEach((row: { post_id: string }) => ids.add(row.post_id));
        if (rows.length < SAVE_PAGE_SIZE) break;
        from += SAVE_PAGE_SIZE;
      }

      if (sequence === loadSequence.current) replaceSavedPostIds(ids);
    } catch (loadError) {
      if (sequence === loadSequence.current) setError(errorMessage(loadError));
      throw loadError;
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [replaceSavedPostIds, userId]);

  useEffect(() => {
    replaceSavedPostIds(new Set());
    replacePendingPostIds(new Set());
    void refresh().catch((loadError: unknown) => {
      console.error("[SavedPosts] initial load failed:", loadError);
    });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh().catch((loadError: unknown) => {
          console.error("[SavedPosts] refresh failed:", loadError);
        });
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      loadSequence.current += 1;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh, replacePendingPostIds, replaceSavedPostIds]);

  const toggleSaved = useCallback(
    async (postId: string) => {
      if (!userId) throw new Error("Sign in to save posts.");
      if (!postId) throw new Error("This post can’t be saved.");
      if (pendingPostIdsRef.current.has(postId)) {
        return savedPostIdsRef.current.has(postId);
      }

      const wasSaved = savedPostIdsRef.current.has(postId);
      const nextSaved = !wasSaved;
      const nextPending = new Set(pendingPostIdsRef.current);
      nextPending.add(postId);
      replacePendingPostIds(nextPending);

      const optimistic = new Set(savedPostIdsRef.current);
      if (nextSaved) optimistic.add(postId);
      else optimistic.delete(postId);
      replaceSavedPostIds(optimistic);

      try {
        const result = nextSaved
          ? await supabase
              .from("post_saves")
              .upsert(
                { post_id: postId, user_id: userId },
                { onConflict: "post_id,user_id", ignoreDuplicates: true },
              )
          : await supabase
              .from("post_saves")
              .delete()
              .eq("post_id", postId)
              .eq("user_id", userId);
        if (result.error) throw result.error;
        return nextSaved;
      } catch (saveError) {
        const rolledBack = new Set(savedPostIdsRef.current);
        if (wasSaved) rolledBack.add(postId);
        else rolledBack.delete(postId);
        replaceSavedPostIds(rolledBack);
        throw saveError;
      } finally {
        const remaining = new Set(pendingPostIdsRef.current);
        remaining.delete(postId);
        replacePendingPostIds(remaining);
      }
    },
    [replacePendingPostIds, replaceSavedPostIds, userId],
  );

  const value = useMemo<SavedPostsContextValue>(
    () => ({
      savedPostIds,
      loading,
      error,
      isSaved: (postId) => savedPostIds.has(postId),
      isPending: (postId) => pendingPostIds.has(postId),
      toggleSaved,
      refresh,
    }),
    [error, loading, pendingPostIds, refresh, savedPostIds, toggleSaved],
  );

  return (
    <SavedPostsContext.Provider value={value}>
      {children}
    </SavedPostsContext.Provider>
  );
}

export function useSavedPosts() {
  const value = useContext(SavedPostsContext);
  if (!value) {
    throw new Error("useSavedPosts must be used inside SavedPostsProvider.");
  }
  return value;
}
