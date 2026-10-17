import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import FriendWallPresentation, {
  type FriendWallCommentView,
  type FriendWallPostView,
} from "./FriendWallPresentation";
import ProfilePostDetail from "./ProfilePostDetail";

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
  parent_id?: string | null;
};

type Props = {
  profileId: string;
  friendName: string;
  canPost: boolean;
  currentUserId: string;
  isOwnProfile?: boolean;
  onCreateHook?: () => void;
};

export default function FriendWall({
  profileId,
  friendName,
  canPost,
  currentUserId,
  isOwnProfile = false,
  onCreateHook,
}: Props) {
  const [posts, setPosts] = useState<FriendWallPostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerProfile, setViewerProfile] = useState<ProfileRow | null>(null);
  const [postDetailId, setPostDetailId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentReactions, setCommentReactions] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [likeBusyPostId, setLikeBusyPostId] = useState<string | null>(null);
  const pendingLikes = useRef(new Set<string>());
  const loadSequence = useRef(0);
  const commentLoadSequence = useRef(0);
  const pendingCommentReactions = useRef(new Set<string>());

  const reload = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!profileId) return;
    const sequence = ++loadSequence.current;
    let active = true;
    commentLoadSequence.current += 1;
    setPostDetailId(null);
    setCommentsLoading(false);
    setCommentsError(null);
    setCommentReactions({});

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
              .select("post_id,reaction_type")
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
      const reactionTypeByPostId = new Map(
        (likesRes.data ?? []).map((row: { post_id: string; reaction_type?: string | null }) => [
          row.post_id,
          row.reaction_type ?? "like",
        ]),
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
            imageUrl: row.image_url,
            imageUrls: row.image_urls,
            mediaType: row.media_type || row.type,
            type: row.type,
            coverUrl: row.cover_url,
            likesCount: row.likes_count ?? 0,
            commentsCount: row.comments_count ?? 0,
            sharesCount: row.shares_count ?? 0,
            likedByCurrentUser: likedPostIds.has(row.id),
            reactionType: reactionTypeByPostId.get(row.id) ?? null,
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

  const handleLike = async (postId: string, reactionType = "like") => {
    if (!currentUserId || pendingLikes.current.has(postId)) return;
    const current = posts.find((post) => post.id === postId);
    if (!current) return;

    pendingLikes.current.add(postId);
    setLikeBusyPostId(postId);
    const shouldRemove =
      current.likedByCurrentUser &&
      (current.reactionType || "like") === reactionType;
    const nextLiked = !shouldRemove;
    const countChange = !current.likedByCurrentUser && nextLiked
      ? 1
      : current.likedByCurrentUser && !nextLiked
        ? -1
        : 0;
    setPosts((previous) =>
      previous.map((post) =>
        post.id === postId
          ? {
              ...post,
              likedByCurrentUser: nextLiked,
              reactionType: nextLiked ? reactionType : null,
              likesCount: Math.max(0, post.likesCount + countChange),
            }
          : post,
      ),
    );

    let existingLikeRemoved = false;
    try {
      if (current.likedByCurrentUser) {
        const { error } = await supabase
            .from("likes")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", currentUserId);
        if (error) throw error;
        existingLikeRemoved = true;
      }
      if (nextLiked) {
        const { error } = await supabase.from("likes").insert({
          post_id: postId,
          user_id: currentUserId,
          reaction_type: reactionType,
        });
        if (error) throw error;
      }
    } catch (likeError) {
      console.error("[FriendWall] like update failed:", likeError);
      if (existingLikeRemoved) {
        await supabase.from("likes").insert({
          post_id: postId,
          user_id: currentUserId,
          reaction_type: current.reactionType || "like",
        });
      }
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

  const loadPostComments = useCallback(async (postId: string) => {
    const requestId = ++commentLoadSequence.current;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const pageSize = 1000;
      const rows: CommentRow[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from("comments")
          .select("id,user_id,author,content,created_at,parent_id")
          .eq("post_id", postId)
          .eq("is_hidden", false)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const page = (data ?? []) as CommentRow[];
        rows.push(...page);
        if (page.length < pageSize) break;
      }

      const comments: FriendWallCommentView[] = rows.map((comment) => ({
        id: comment.id,
        userId: comment.user_id,
        authorName: comment.author || "Flicks member",
        content: comment.content,
        createdAt: comment.created_at,
        parentId: comment.parent_id ?? null,
      }));
      const reactions: Record<string, Record<string, string[]>> = {};
      const commentIds = comments.map((comment) => comment.id);
      for (let start = 0; start < commentIds.length; start += 100) {
        const batch = commentIds.slice(start, start + 100);
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase
            .from("comment_reactions")
            .select("comment_id,user_id,emoji")
            .in("comment_id", batch)
            .order("comment_id", { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (error) {
            console.warn("[FriendWall] comment reactions load failed:", error.message);
            break;
          }
          const page = data ?? [];
          for (const reaction of page as Array<{ comment_id: string; user_id: string; emoji: string }>) {
            const commentReactionMap = reactions[reaction.comment_id] ?? {};
            commentReactionMap[reaction.emoji] = [
              ...(commentReactionMap[reaction.emoji] ?? []),
              reaction.user_id,
            ];
            reactions[reaction.comment_id] = commentReactionMap;
          }
          if (page.length < pageSize) break;
        }
      }

      if (requestId !== commentLoadSequence.current) return;
      setPosts((previous) =>
        previous.map((post) => post.id === postId ? { ...post, comments } : post),
      );
      setCommentReactions(reactions);
    } catch (loadError) {
      console.error("[FriendWall] comment load failed:", loadError);
      if (requestId === commentLoadSequence.current) {
        setCommentsError("Comments could not be loaded. Please try again.");
      }
    } finally {
      if (requestId === commentLoadSequence.current) setCommentsLoading(false);
    }
  }, []);

  const openPostDetail = useCallback((postId: string) => {
    setPostDetailId(postId);
    setCommentDraft("");
    setCommentsError(null);
    setCommentReactions({});
    void loadPostComments(postId);
  }, [loadPostComments]);

  const closePostDetail = useCallback(() => {
    commentLoadSequence.current += 1;
    setPostDetailId(null);
    setCommentDraft("");
    setCommentsLoading(false);
  }, []);

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
        .select("id,user_id,author,content,created_at,parent_id")
        .single();
      if (commentError) throw commentError;

      const comment = data as CommentRow;
      const commentView: FriendWallCommentView = {
        id: comment.id,
        userId: comment.user_id,
        authorName: comment.author || authorName,
        content: comment.content,
        createdAt: comment.created_at,
        parentId: comment.parent_id ?? null,
      };
      setPosts((previous) =>
        previous.map((post) =>
          post.id === postId
            ? {
                ...post,
                commentsCount: post.commentsCount + 1,
                comments: [...(post.comments ?? []), commentView],
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

  const handleSaveCommentEdit = async (
    postId: string,
    commentId: string,
    content: string,
  ) => {
    const cleanedContent = content.trim();
    const postSnapshot = posts.find((post) => post.id === postId);
    const commentSnapshot = postSnapshot?.comments?.find(
      (comment) => comment.id === commentId,
    );
    if (
      !postId ||
      !commentId ||
      !cleanedContent ||
      !currentUserId
    ) return false;

    // Keep the open post detail and profile timeline in sync immediately.
    setPosts((previous) =>
      previous.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: (post.comments ?? []).map((comment) =>
                comment.id === commentId
                  ? { ...comment, content: cleanedContent }
                  : comment,
              ),
            }
          : post,
      ),
    );
    try {
      const { data, error } = await supabase
        .from("comments")
        .update({ content: cleanedContent })
        .eq("id", commentId)
        .eq("post_id", postId)
        .eq("user_id", currentUserId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Comment was not found or could not be edited.");
      toast.success("Comment updated.");
      return true;
    } catch (error) {
      console.error("[FriendWall] comment update failed:", error);
      if (commentSnapshot) {
        setPosts((previous) =>
          previous.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: (post.comments ?? []).map((comment) =>
                    comment.id === commentId
                      ? { ...comment, content: commentSnapshot.content }
                      : comment,
                  ),
                }
              : post,
          ),
        );
      }
      toast.error("Your comment could not be updated.");
      return false;
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const postSnapshot = posts.find((post) => post.id === postId);
    const commentSnapshot = postSnapshot?.comments?.find(
      (comment) => comment.id === commentId,
    );
    if (
      !postId ||
      !commentId ||
      !currentUserId
    ) return false;
    const isTopLevel = commentSnapshot ? !commentSnapshot.parentId : false;
    const reactionsSnapshot = commentReactions[commentId];

    // Remove the row and update its count before awaiting the network.
    setPosts((previous) =>
      previous.map((post) =>
        post.id === postId
          ? {
              ...post,
              commentsCount: commentSnapshot && isTopLevel
                ? Math.max(0, post.commentsCount - 1)
                : post.commentsCount,
              comments: (post.comments ?? []).filter(
                (comment) => comment.id !== commentId,
              ),
            }
          : post,
      ),
    );
    setCommentReactions((previous) => {
      const next = { ...previous };
      delete next[commentId];
      return next;
    });

    try {
      const { data, error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("post_id", postId)
        .eq("user_id", currentUserId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Comment was not found or could not be deleted.");
      toast.success("Comment deleted.");
      return true;
    } catch (error) {
      console.error("[FriendWall] comment delete failed:", error);
      if (commentSnapshot) {
        setPosts((previous) =>
          previous.map((post) => {
            if (post.id !== postId) return post;
            const comments = [...(post.comments ?? [])];
            if (!comments.some((comment) => comment.id === commentId)) {
              const insertAt = comments.findIndex(
                (comment) => comment.createdAt > commentSnapshot.createdAt,
              );
              comments.splice(insertAt < 0 ? comments.length : insertAt, 0, commentSnapshot);
            }
            return {
              ...post,
              commentsCount: isTopLevel ? post.commentsCount + 1 : post.commentsCount,
              comments,
            };
          }),
        );
      }
      if (reactionsSnapshot) {
        setCommentReactions((previous) => ({
          ...previous,
          [commentId]: reactionsSnapshot,
        }));
      }
      toast.error("Your comment could not be deleted.");
      return false;
    }
  };

  const handleCommentReact = async (commentId: string, emoji: string) => {
    if (!currentUserId || pendingCommentReactions.current.has(commentId)) return;
    pendingCommentReactions.current.add(commentId);
    const previous = commentReactions[commentId] ?? {};
    const alreadyReacted = (previous[emoji] ?? []).includes(currentUserId);
    const next: Record<string, string[]> = Object.fromEntries(
      Object.entries(previous)
        .map(([key, users]) => [
          key,
          users.filter((userId) => userId !== currentUserId),
        ])
        .filter(([, users]) => (users as string[]).length > 0),
    );
    if (!alreadyReacted) {
      next[emoji] = [...(next[emoji] ?? []), currentUserId];
    }
    setCommentReactions((current) => ({ ...current, [commentId]: next }));
    try {
      if (alreadyReacted) {
        const { error } = await supabase
          .from("comment_reactions")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("comment_reactions")
          .upsert(
            { comment_id: commentId, user_id: currentUserId, emoji },
            { onConflict: "comment_id,user_id" },
          );
        if (error) throw error;
      }
    } catch (error) {
      console.error("[FriendWall] comment reaction failed:", error);
      setCommentReactions((current) => ({ ...current, [commentId]: previous }));
      toast.error("Your comment reaction could not be saved.");
    } finally {
      pendingCommentReactions.current.delete(commentId);
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

  const selectedPost =
    posts.find((post) => post.id === postDetailId) ?? null;

  return (
    <>
      <FriendWallPresentation
        friendName={friendName}
        canPost={canPost}
        isOwnProfile={isOwnProfile}
        posts={posts}
        loading={loading}
        error={error}
        likeBusyPostId={likeBusyPostId}
        onOpenComposer={() => setComposerOpen(true)}
        onCreateHook={onCreateHook}
        onLike={(postId, reactionType) => void handleLike(postId, reactionType)}
        onShare={(postId) => void handleShare(postId)}
        onOpenPostDetail={openPostDetail}
        onRetry={reload}
      />
      {selectedPost && (
        <ProfilePostDetail
          post={selectedPost}
          comments={selectedPost.comments}
          commentsLoading={commentsLoading}
          commentsError={commentsError}
          commentDraft={commentDraft}
          commentBusy={commentBusy}
          commentReactions={commentReactions}
          currentUserId={currentUserId}
          onClose={closePostDetail}
          onCommentDraftChange={setCommentDraft}
          onSubmitComment={() => void handleSubmitComment(selectedPost.id)}
          onPostReact={(reactionType) =>
            void handleLike(selectedPost.id, reactionType)
          }
          onCommentReact={(commentId, emoji) =>
            void handleCommentReact(commentId, emoji)
          }
          onSaveCommentEdit={handleSaveCommentEdit}
          onDeleteComment={handleDeleteComment}
        />
      )}
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
