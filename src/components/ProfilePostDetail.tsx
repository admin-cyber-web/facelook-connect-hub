import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Check,
  Clock3,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Send,
  X,
} from "lucide-react";
import { ReactionBar } from "./ReactionBar";
import type {
  FriendWallCommentView,
  FriendWallPostView,
} from "./FriendWallPresentation";

const REACTION_TYPE_BY_EMOJI: Record<string, string> = {
  "👍": "like",
  "❤️": "love",
  "😂": "haha",
  "🔥": "fire",
  "😮": "wow",
};

const reactionEmoji = (reactionType?: string | null) => {
  switch (reactionType) {
    case "love": return "❤️";
    case "haha": return "😂";
    case "fire": return "🔥";
    case "wow": return "😮";
    default: return "👍";
  }
};

function formatDetailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isVideo(post: FriendWallPostView) {
  const kind = `${post.mediaType || ""} ${post.type || ""}`.toLowerCase();
  return (
    kind.includes("video") ||
    kind.includes("reel") ||
    /\.(mp4|m4v|mov|webm|ogg)(?:[?#]|$)/i.test(post.mediaUrl || "")
  );
}

export type ProfilePostDetailProps = {
  post: FriendWallPostView;
  comments?: FriendWallCommentView[];
  commentsLoading: boolean;
  commentsError?: string | null;
  commentDraft: string;
  commentBusy: boolean;
  commentReactions: Record<string, Record<string, string[]>>;
  currentUserId: string;
  onClose: () => void;
  onCommentDraftChange: (value: string) => void;
  onSubmitComment: () => void;
  onPostReact: (reactionType: string) => void;
  onCommentReact: (commentId: string, emoji: string) => void;
  onSaveCommentEdit: (commentId: string, content: string) => Promise<boolean>;
  onDeleteComment: (commentId: string) => Promise<boolean>;
};

export default function ProfilePostDetail({
  post,
  comments,
  commentsLoading,
  commentsError,
  commentDraft,
  commentBusy,
  commentReactions,
  currentUserId,
  onClose,
  onCommentDraftChange,
  onSubmitComment,
  onPostReact,
  onCommentReact,
  onSaveCommentEdit,
  onDeleteComment,
}: ProfilePostDetailProps) {
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [activeCommentReactionId, setActiveCommentReactionId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ commentId: string; x: number; y: number } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, [onClose]);

  const showCommentMenu = (comment: FriendWallCommentView, x: number, y: number) => {
    if (comment.userId !== currentUserId) return;
    setMenu({
      commentId: comment.id,
      x: Math.min(Math.max(12, x), window.innerWidth - 200),
      y: Math.min(Math.max(12, y), window.innerHeight - 125),
    });
  };

  const startLongPress = (comment: FriendWallCommentView, event: ReactPointerEvent) => {
    if (comment.userId !== currentUserId) return;
    if ((event.target as HTMLElement).closest("button, input, textarea")) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    const { clientX, clientY } = event;
    longPressTimer.current = setTimeout(
      () => showCommentMenu(comment, clientX, clientY),
      550,
    );
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const postImages = [...new Set([
    ...(post.imageUrls ?? []),
    post.imageUrl,
    post.mediaUrl,
  ].filter((url): url is string => Boolean(url)))];

  return createPortal(
    <div
      className="profile-post-detail fixed inset-0 z-[90000] flex h-[100dvh] justify-center bg-black/65 text-[#39272a] backdrop-blur-sm"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: 0,
        overscrollBehavior: "none",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Post by ${post.authorName}`}
    >
      <div className="flex h-full min-h-0 w-full max-w-[780px] flex-col overflow-hidden border-x border-[#800020]/10 bg-[#fffdf3] shadow-2xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-[#800020]/10 bg-[#fffdf3] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to profile timeline"
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-extrabold text-[#800020] transition-colors hover:bg-[#800020]/[0.07] active:scale-95"
          >
            ← Back
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-black text-[#39272a]">Post</h1>
            <p className="text-[11px] text-[#756365]">
              {post.likesCount} {post.likesCount === 1 ? "reaction" : "reactions"} · {post.commentsCount} {post.commentsCount === 1 ? "comment" : "comments"}
            </p>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <article className="border-b border-[#800020]/10 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#800020]/15 bg-[#800020]/10 text-xs font-black text-[#800020]">
                {post.authorAvatarUrl ? (
                  <img src={post.authorAvatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  post.authorName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#39272a]">{post.authorName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#756365]">
                  <Clock3 size={11} aria-hidden="true" />
                  {formatDetailDate(post.createdAt)}
                </p>
              </div>
            </div>
            {post.content.trim() && (
              <p className="whitespace-pre-wrap break-words py-4 text-sm leading-relaxed text-[#39272a]">
                {post.content}
              </p>
            )}
            {isVideo(post) && post.mediaUrl ? (
              <video
                src={post.mediaUrl}
                poster={post.coverUrl || undefined}
                controls
                playsInline
                preload="metadata"
                className="max-h-[65vh] w-full rounded-xl bg-black object-contain"
                aria-label={`Video shared by ${post.authorName}`}
              />
            ) : postImages.length > 0 ? (
              <div className={`grid gap-1 overflow-hidden rounded-xl bg-black/5 ${postImages.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {postImages.map((url, index) => (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={`Photo ${index + 1} shared by ${post.authorName}`}
                    loading="lazy"
                    decoding="async"
                    className="max-h-[60vh] min-h-32 w-full object-contain"
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between border-y border-[#800020]/10 py-2 text-xs font-semibold text-[#756365]">
              <span>{post.likesCount} {post.likesCount === 1 ? "reaction" : "reactions"}</span>
              <span>{post.commentsCount} {post.commentsCount === 1 ? "comment" : "comments"}</span>
            </div>
            <div className="relative flex justify-center py-2">
              <button
                type="button"
                onClick={() => onPostReact(post.likedByCurrentUser ? post.reactionType || "like" : "like")}
                aria-pressed={post.likedByCurrentUser}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-extrabold transition-colors hover:bg-[#800020]/[0.06] ${post.likedByCurrentUser ? "text-[#800020]" : "text-[#756365]"}`}
              >
                {post.likedByCurrentUser ? reactionEmoji(post.reactionType) : <Heart size={16} />}
                {post.likedByCurrentUser ? "Reacted" : "Like"}
              </button>
              <button
                type="button"
                onClick={() => setReactionPickerOpen((open) => !open)}
                aria-label="Choose a reaction"
                className="ml-1 rounded-lg px-2 text-[#756365] hover:bg-[#800020]/[0.06]"
              >
                <MoreHorizontal size={18} />
              </button>
              {reactionPickerOpen && (
                <div className="absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2">
                  <ReactionBar
                    onReact={(emoji) => {
                      const type = REACTION_TYPE_BY_EMOJI[emoji];
                      if (type) onPostReact(type);
                      setReactionPickerOpen(false);
                    }}
                    onClose={() => setReactionPickerOpen(false)}
                  />
                </div>
              )}
            </div>
          </article>

          <section aria-label="Comments" className="px-4 pb-5 sm:px-6">
            <h2 className="sticky top-0 z-10 -mx-4 border-b border-[#800020]/10 bg-[#fffdf3]/95 px-4 py-3 text-sm font-black text-[#39272a] backdrop-blur sm:-mx-6 sm:px-6">
              Comments <span className="font-semibold text-[#756365]">({post.commentsCount})</span>
            </h2>
            {commentsLoading ? (
              <div className="flex justify-center py-10" role="status" aria-label="Loading comments">
                <Loader2 size={22} className="animate-spin text-[#800020]" />
              </div>
            ) : commentsError ? (
              <p role="alert" className="py-8 text-center text-sm text-[#800020]">{commentsError}</p>
            ) : comments?.length ? (
              <div className="divide-y divide-[#800020]/[0.08]">
                {comments.map((comment) => {
                  const isMine = comment.userId === currentUserId;
                  const date = formatDetailDate(comment.createdAt);
                  const isEditing = editingCommentId === comment.id;
                  return (
                    <div
                      key={comment.id}
                      className={`flex items-start gap-2.5 py-3 ${comment.parentId ? "ml-8 border-l border-[#800020]/10 pl-3" : ""}`}
                      data-testid={`detail-comment-${comment.id}`}
                      onPointerDown={(event) => startLongPress(comment, event)}
                      onPointerUp={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      onPointerMove={cancelLongPress}
                      onContextMenu={(event) => {
                        if (!isMine) return;
                        event.preventDefault();
                        showCommentMenu(comment, event.clientX, event.clientY);
                      }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#800020]/10 text-[10px] font-black text-[#800020]">
                        {comment.authorName.trim().slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 rounded-2xl bg-[#800020]/[0.045] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-[#800020]">{comment.authorName}</p>
                          <div className="flex items-center gap-2">
                            <time className="text-[10px] text-[#756365]" dateTime={comment.createdAt}>{date}</time>
                            {isMine && (
                              <button
                                type="button"
                                aria-label="Comment options"
                                onClick={(event) => {
                                  const rect = event.currentTarget.getBoundingClientRect();
                                  showCommentMenu(comment, rect.left, rect.bottom);
                                }}
                                className="rounded-full p-1 text-[#756365] hover:bg-[#800020]/10 hover:text-[#800020]"
                              >
                                <MoreHorizontal size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                        {isEditing ? (
                          <form
                            className="mt-2"
                            onSubmit={async (event) => {
                              event.preventDefault();
                              setEditBusy(true);
                              const saved = await onSaveCommentEdit(comment.id, editingText);
                              setEditBusy(false);
                              if (saved) setEditingCommentId(null);
                            }}
                          >
                            <textarea
                              value={editingText}
                              onChange={(event) => setEditingText(event.target.value)}
                              rows={3}
                              autoFocus
                              className="w-full resize-y rounded-xl border border-[#800020]/15 bg-white px-3 py-2 text-sm text-[#39272a] outline-none focus:border-[#800020]/40"
                              aria-label="Edit your comment"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingCommentId(null)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#756365]">Cancel</button>
                              <button type="submit" disabled={editBusy || !editingText.trim()} className="inline-flex items-center gap-1 rounded-lg bg-[#800020] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                                <Check size={13} /> Save
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#39272a]">{comment.content}</p>
                            <div className="mt-2 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setActiveCommentReactionId((id) => id === comment.id ? null : comment.id)}
                                className="text-[11px] font-bold text-[#756365] hover:text-[#800020]"
                              >
                                React
                              </button>
                              {activeCommentReactionId === comment.id && (
                                <div className="relative z-20">
                                  <ReactionBar
                                    onReact={(emoji) => onCommentReact(comment.id, emoji)}
                                    onClose={() => setActiveCommentReactionId(null)}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(commentReactions[comment.id] ?? {})
                                .filter(([, users]) => users.length > 0)
                                .map(([emoji, users]) => (
                                  <span
                                    key={emoji}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${users.includes(currentUserId) ? "border-[#800020]/25 bg-[#800020]/[0.08] text-[#800020]" : "border-[#800020]/10 bg-white text-[#756365]"}`}
                                    aria-label={`${users.length} ${emoji} reactions`}
                                  >
                                    <span>{emoji}</span>
                                    <span>{users.length}</span>
                                  </span>
                                ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-[#756365]">Be the first to comment.</p>
            )}
          </section>
        </main>

        <form
          className="shrink-0 border-t border-[#800020]/10 bg-[#fffdf3] px-3 pt-3 sm:px-6"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitComment();
          }}
        >
          <label htmlFor={`profile-comment-${post.id}`} className="sr-only">Write a comment</label>
          <div className="flex items-center gap-2">
            <input
              id={`profile-comment-${post.id}`}
              value={commentDraft}
              onChange={(event) => onCommentDraftChange(event.target.value)}
              placeholder="Write a comment…"
              className="min-w-0 flex-1 rounded-full border border-[#800020]/15 bg-white px-4 py-3 text-sm text-[#39272a] outline-none placeholder:text-[#756365]/70 focus:border-[#800020]/45"
              aria-label="Write a comment"
            />
            <button
              type="submit"
              disabled={commentBusy || !commentDraft.trim()}
              aria-label="Send comment"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#800020] text-white disabled:opacity-45"
            >
              {commentBusy ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </form>
      </div>

      <AnimatePresence>
        {menu && (
          <>
            <button
              type="button"
              aria-label="Close comment options"
              className="fixed inset-0 z-[90001] cursor-default"
              onClick={() => setMenu(null)}
            />
            <div
              className="fixed z-[90002] min-w-44 overflow-hidden rounded-xl border border-[#800020]/10 bg-white py-1 shadow-2xl"
              style={{ left: menu.x, top: menu.y }}
            >
              <button
                type="button"
                onClick={() => {
                  const comment = comments?.find((item) => item.id === menu.commentId);
                  if (comment) {
                    setEditingCommentId(comment.id);
                    setEditingText(comment.content);
                  }
                  setMenu(null);
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-bold text-[#39272a] hover:bg-[#800020]/[0.06]"
              >
                Edit comment
              </button>
              <button
                type="button"
                onClick={async () => {
                  const commentId = menu.commentId;
                  setMenu(null);
                  if (window.confirm("Delete this comment?")) {
                    await onDeleteComment(commentId);
                  }
                }}
                className="flex w-full items-center gap-2 border-t border-[#800020]/[0.08] px-4 py-3 text-left text-xs font-bold text-red-700 hover:bg-red-50"
              >
                Delete comment
              </button>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
