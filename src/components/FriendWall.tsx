import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import FriendWallPresentation, {
  type FriendWallPostView,
} from "./FriendWallPresentation";

const CreatePost = lazy(() => import("./CreatePost"));

type WallPostRow = {
  id: string;
  author_id: string;
  author: string | null;
  content: string | null;
  media_url: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  cover_url: string | null;
  media_type: string | null;
  type: string | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username?: string | null;
};

type CommentRow = {
  id: string;
  user_id: string;
  author: string | null;
  content: string;
  created_at: string;
};

type Props = {
  profileId: string;
  friendName: string;
  canPost: boolean;
  currentUserId: string;
};

export default function FriendWall({
  profileId,
  friendName,
  canPost,
  currentUserId,
}: Props) {
  const [posts, setPosts] = useState<FriendWallPostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerProfile, setViewerProfile] = useState<ProfileRow | null>(null);
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [likeBusyPostId, setLikeBusyPostId] = useState<string | null>(null);
  const pendingLikes = useRef(new Set<string>());
  const loadSequence = useRef(0);

  const reload = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!profileId) return;
    const sequence = ++loadSequence.current;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      const query = supabase
        .from("posts")
        .select(
          "id,author_id,author,content,media_url,image_url,image_urls,cover_url,media_type,type,likes_count,comments_count,shares_count,created_at,metadata",
        )
        .or(
          `wall_owner_id.eq.${profileId},and(author_id.eq.${profileId},wall_owner_id.is.null)`,
        );

      // A non-friend may read only public timeline posts. Friends and the
      // profile owner can also see friends-only posts.
      if (!canPost && currentUserId !== profileId) {
        query.eq("visibility", "public");
      }

      const { data: postRows, error: postError } = await query
        .order("created_at", { ascending: false })
        .limit(30);

      if (!active || sequence !== loadSequence.current) return;
      if (postError) {
        console.error("[FriendWall] post load failed:", postError);
        setError("Please try again. If this is a new setup, the friend-wall database migration must be applied first.");
        setPosts([]);
        setLoading(false);
        return;
      }

      const rows = (postRows ?? []) as WallPostRow[];
      const authorIds = [...new Set([
        ...rows.map((row) => row.author_id).filter(Boolean),
        currentUserId,
      ])];

      const [profilesRes, likesRes] = await Promise.all([
        authorIds.length
          ? supabase
              .from("profiles")
              .select("id,full_name,avatar_url,username")
              .in("id", authorIds)
          : Promise.resolve({ data: [], error: null }),
        rows.length && currentUserId
          ? supabase
              .from("likes")
              .select("post_id")
              .eq("user_id", currentUserId)
              .in("post_id", rows.map((row) => row.id))
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!active || sequence !== loadSequence.current) return;
      if (likesRes.error) {
        console.error("[FriendWall] like state load failed:", likesRes.error);
        setError("Could not load post reactions. Please try again.");
        setPosts([]);
        setLoading(false);
        return;
      }

      const profileMap = new Map(
        ((profilesRes.data ?? []) as ProfileRow[]).map((profile) => [
          profile.id,
          profile,
        ]),
      );
      setViewerProfile(profileMap.get(currentUserId) ?? null);
      const likedPostIds = new Set(
        (likesRes.data ?? []).map((row: { post_id: string }) => row.post_id),
      );

      setPosts(
        rows.map((row) => {
          const author = profileMap.get(row.author_id);
          const metadata = row.metadata ?? {};
          const metadataAvatar =
            typeof metadata.author_avatar === "string"
              ? metadata.author_avatar
              : null;
          return {
            id: row.id,
            authorName: row.author || author?.full_name || "Flicks member",
            authorAvatarUrl: author?.avatar_url || metadataAvatar,
            content: row.content ?? "",
            createdAt: row.created_at,
            mediaUrl: row.media_url || row.image_url || row.cover_url,
            imageUrls: row.image_urls,
            mediaType: row.media_type || row.type,
            likesCount: row.likes_count ?? 0,
            commentsCount: row.comments_count ?? 0,
            sharesCount: row.shares_count ?? 0,
            likedByCurrentUser: likedPostIds.has(row.id),
          };
        }),
      );
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [profileId, currentUserId, canPost, refreshVersion]);

  useEffect(() => {
    const onPostCreated = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (detail?.wall_owner_id === profileId) reload();
    };
    window.addEventListener("flicks:post-created", onPostCreated);
    return () => window.removeEventListener("flicks:post-created", onPostCreated);
  }, [profileId, reload]);

  const handleLike = async (postId: string) => {
    if (!currentUserId || pendingLikes.current.has(postId)) return;
    const current = posts.find((post) => post.id === postId);
    if (!current) return;

    pendingLikes.current.add(postId);
    setLikeBusyPostId(postId);
    const nextLiked = !current.likedByCurrentUser;
    setPosts((previous) =>
      previous.map((post) =>
        post.id === postId
          ? {
              ...post,
              likedByCurrentUser: nextLiked,
              likesCount: Math.max(0, post.likesCount + (nextLiked ? 1 : -1)),
            }
          : post,
      ),
    );

    try {
      const result = nextLiked
        ? await supabase.from("likes").insert({ post_id: postId, user_id: currentUserId })
        : await supabase
            .from("likes")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", currentUserId);
      if (result.error) throw result.error;
    } catch (likeError) {
      console.error("[FriendWall] like update failed:", likeError);
      setPosts((previous) =>
        previous.map((post) =>
          post.id === postId
            ? {
                ...post,
                likedByCurrentUser: current.likedByCurrentUser,
                likesCount: current.likesCount,
              }
            : post,
        ),
      );
      toast.error("Your reaction could not be saved. Please try again.");
    } finally {
      pendingLikes.current.delete(postId);
      setLikeBusyPostId(null);
    }
  };

  const handleToggleComments = async (postId: string) => {
    if (openCommentPostId === postId) {
      setOpenCommentPostId(null);
      setCommentDraft("");
      return;
    }
    setOpenCommentPostId(postId);
    setCommentDraft("");

    const post = posts.find((item) => item.id === postId);
    if (post?.comments !== undefined) return;

    const { data, error: commentsError } = await supabase
      .from("comments")
      .select("id,user_id,author,content,created_at")
      .eq("post_id", postId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true })
      .limit(30);
    if (commentsError) {
      console.error("[FriendWall] comment load failed:", commentsError);
      toast.error("Comments could not be loaded.");
      return;
    }

    const comments = (data ?? []) as CommentRow[];
    const commenterIds = [...new Set(comments.map((comment) => comment.user_id).filter(Boolean))];
    const { data: profiles } = commenterIds.length
      ? await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", commenterIds)
      : { data: [] };
    const names = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map(
        (profile) => [profile.id, profile.full_name],
      ),
    );
    setPosts((previous) =>
      previous.map((item) =>
        item.id === postId
          ? {
              ...item,
              comments: comments.map((comment) => ({
                id: comment.id,
                authorName:
                  comment.author || names.get(comment.user_id) || "Flicks member",
                content: comment.content,
                createdAt: comment.created_at,
              })),
            }
          : item,
      ),
    );
  };

  const handleSubmitComment = async (postId: string) => {
    const content = commentDraft.trim();
    if (!content || !currentUserId || commentBusy) return;
    setCommentBusy(true);
    const authorName = viewerProfile?.full_name || "Flicks member";
    try {
      const { data, error: commentError } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          user_id: currentUserId,
          author: authorName,
          content,
        })
        .select("id,user_id,author,content,created_at")
        .single();
      if (commentError) throw commentError;

      const comment = data as CommentRow;
      setPosts((previous) =>
        previous.map((post) =>
          post.id === postId
            ? {
                ...post,
                commentsCount: post.commentsCount + 1,
                comments: [
                  ...(post.comments ?? []),
                  {
                    id: comment.id,
                    authorName,
                    content: comment.content,
                    createdAt: comment.created_at,
                  },
                ],
              }
            : post,
        ),
      );
      setCommentDraft("");
    } catch (commentError) {
      console.error("[FriendWall] comment insert failed:", commentError);
      toast.error("Your comment could not be posted. Please try again.");
    } finally {
      setCommentBusy(false);
    }
  };

  const handleShare = async (postId: string) => {
    const url = `${window.location.origin}/post/${encodeURIComponent(postId)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${friendName}'s post`, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Post link copied.");
      } else if (window.prompt("Copy this post link:", url) === null) {
        return;
      }

      if (currentUserId) {
        const { error: shareError } = await supabase
          .from("shares")
          .insert({ post_id: postId, user_id: currentUserId });
        if (!shareError) {
          setPosts((previous) =>
            previous.map((post) =>
              post.id === postId
                ? { ...post, sharesCount: post.sharesCount + 1 }
                : post,
            ),
          );
        } else if (shareError.code !== "23505") {
          console.error("[FriendWall] share record failed:", shareError);
          toast.error("The post was shared, but the share could not be recorded.");
        }
      }
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      ) {
        return;
      }
      console.error("[FriendWall] sharing failed:", shareError);
      toast.error("The post could not be shared. Please try again.");
    }
  };

  return (
    <>
      <FriendWallPresentation
        friendName={friendName}
        canPost={canPost}
        posts={posts}
        loading={loading}
        error={error}
        openCommentPostId={openCommentPostId}
        commentDraft={commentDraft}
        commentBusy={commentBusy}
        likeBusyPostId={likeBusyPostId}
        onOpenComposer={() => setComposerOpen(true)}
        onLike={(postId) => void handleLike(postId)}
        onShare={(postId) => void handleShare(postId)}
        onToggleComments={(postId) => void handleToggleComments(postId)}
        onCommentDraftChange={setCommentDraft}
        onSubmitComment={(postId) => void handleSubmitComment(postId)}
        onRetry={reload}
      />
      <Suspense fallback={null}>
        <CreatePost
          isOpen={composerOpen}
          onClose={() => setComposerOpen(false)}
          userProfile={viewerProfile}
          wallOwnerId={profileId}
          wallOwnerName={friendName}
        />
      </Suspense>
    </>
  );
}
