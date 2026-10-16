import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import SavedItemsView from "@/components/saved-items/SavedItemsView";

const PAGE_SIZE = 24;

type SavedPost = {
  id: string;
  author: string;
  avatarUrl: string | null;
  content: string;
  mediaUrl: string | null;
  imageUrls: string[];
  coverUrl: string | null;
  type: string | null;
  createdAt: string;
  savedAt: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
};

type SavedRow = { post_id: string; created_at: string };
type PostRow = {
  id: string;
  author_id: string | null;
  author: string | null;
  content: string | null;
  media_url: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  cover_url: string | null;
  type: string | null;
  media_type: string | null;
  created_at: string;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
};
type AuthorRow = { id: string; full_name: string | null; avatar_url: string | null };

export default function SavedItemsPage({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const requestSequence = useRef(0);
  const loadingMoreRef = useRef(false);

  const loadPage = useCallback(
    async (start: number, append: boolean) => {
      if (!currentUserId || (append && loadingMoreRef.current)) return;
      const sequence = ++requestSequence.current;
      if (append) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
        setPosts([]);
        setOffset(0);
      }
      setError(null);

      try {
        const { data: savedRows, count, error: savesError } = await supabase
          .from("post_saves")
          .select("post_id,created_at", { count: "exact" })
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .range(start, start + PAGE_SIZE - 1);
        if (savesError) throw savesError;

        const rows = (savedRows ?? []) as SavedRow[];
        const postIds = [...new Set(rows.map((row) => row.post_id))];
        const { data: postRows, error: postsError } = postIds.length
          ? await supabase
              .from("posts")
              .select(
                "id,author_id,author,content,media_url,image_url,image_urls,cover_url,type,media_type,created_at,likes_count,comments_count,shares_count",
              )
              .in("id", postIds)
          : { data: [], error: null };
        if (postsError) throw postsError;

        const normalizedPosts = (postRows ?? []) as PostRow[];
        const authorIds = [
          ...new Set(normalizedPosts.map((post) => post.author_id).filter((id): id is string => Boolean(id))),
        ];
        const { data: authors, error: authorsError } = authorIds.length
          ? await supabase
              .from("profiles")
              .select("id,full_name,avatar_url")
              .in("id", authorIds)
          : { data: [], error: null };
        if (authorsError) throw authorsError;

        if (sequence !== requestSequence.current) return;
        const postMap = new Map(normalizedPosts.map((post) => [post.id, post]));
        const authorMap = new Map(
          ((authors ?? []) as AuthorRow[]).map((author) => [author.id, author]),
        );
        const page = rows.flatMap((saved) => {
          const post = postMap.get(saved.post_id);
          if (!post) return [];
          const author = post.author_id ? authorMap.get(post.author_id) : null;
          return [{
            id: post.id,
            author: post.author || author?.full_name || "Flicks member",
            avatarUrl: author?.avatar_url ?? null,
            content: post.content ?? "",
            mediaUrl: post.media_url || post.image_url || null,
            imageUrls: Array.isArray(post.image_urls) ? post.image_urls : [],
            coverUrl: post.cover_url ?? null,
            type: post.media_type || post.type,
            createdAt: post.created_at,
            savedAt: saved.created_at,
            likesCount: post.likes_count ?? 0,
            commentsCount: post.comments_count ?? 0,
            sharesCount: post.shares_count ?? 0,
          }];
        });

        setPosts((current) => {
          if (!append) return page;
          const existing = new Set(current.map((post) => post.id));
          return [...current, ...page.filter((post) => !existing.has(post.id))];
        });
        setOffset(start + rows.length);
        setHasMore(start + rows.length < (count ?? start + rows.length));
      } catch (loadError) {
        console.error("[SavedItemsPage] load failed:", loadError);
        if (sequence === requestSequence.current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Saved items could not be loaded. Please try again.",
          );
        }
      } finally {
        if (sequence === requestSequence.current) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [currentUserId],
  );

  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(false);
    void loadPage(0, false);
    return () => {
      requestSequence.current += 1;
      loadingMoreRef.current = false;
    };
  }, [currentUserId, loadPage, refreshSavedIds]);

  const handleUnsave = useCallback((postId: string) => {
    setPosts((current) => current.filter((post) => post.id !== postId));
    setOffset((current) => Math.max(0, current - 1));
  }, []);

  return (
    <SavedItemsView
      posts={posts}
      loading={loading}
      error={error}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => void loadPage(offset, true)}
      onOpenPost={(postId) => navigate(`/post/${encodeURIComponent(postId)}`)}
      onUnsave={handleUnsave}
    />
  );
}
