import { useState } from "react";
import {
  ChevronDown,
  Clock3,
  Heart,
  Image as ImageIcon,
  LockKeyhole,
  MessageCircle,
  PenLine,
  RotateCw,
  Share2,
  Video,
} from "lucide-react";
import AutoPlayMutedVideo from "@/components/AutoPlayMutedVideo";
import SavePostButton from "./SavePostButton";
import { ReactionBar, useDismissableReactionPicker } from "./ReactionBar";

const REACTION_TYPE_BY_EMOJI: Record<string, string> = {
  "👍": "like",
  "❤️": "love",
  "😂": "haha",
  "🔥": "fire",
  "😮": "wow",
};

export type FriendWallCommentView = {
  id: string;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
};

export type FriendWallPostView = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
  mediaUrl?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  mediaType?: string | null;
  type?: string | null;
  coverUrl?: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  likedByCurrentUser: boolean;
  reactionType?: string | null;
  comments?: FriendWallCommentView[];
};

export type FriendWallPresentationProps = {
  friendName: string;
  canPost: boolean;
  posts: FriendWallPostView[];
  loading: boolean;
  error: string | null;
  likeBusyPostId?: string | null;
  onOpenComposer: () => void;
  isOwnProfile?: boolean;
  onCreateHook?: () => void;
  onLike: (postId: string, reactionType?: string) => void;
  onShare: (postId: string) => void;
  onOpenPostDetail: (postId: string) => void;
  onRetry: () => void;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: "Recently", dateTime: undefined };

  return {
    label: new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
    dateTime: date.toISOString(),
  };
}

function isVideoPost(post: FriendWallPostView) {
  const kind = post.mediaType?.toLowerCase() ?? "";
  const url = post.mediaUrl?.split("?")[0] ?? "";
  return (
    kind.includes("video") ||
    /\.(mp4|webm|ogg|mov|m4v)$/i.test(url)
  );
}

function countLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function Avatar({
  name,
  src,
  size = "regular",
}: {
  name: string;
  src?: string | null;
  size?: "regular" | "small";
}) {
  const sizeClass = size === "small" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";

  return (
    <div
      className={`profile-nav-wall-avatar flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-fuchsia-200/20 bg-gradient-to-br from-fuchsia-300/25 via-violet-300/20 to-cyan-200/20 font-extrabold text-fuchsia-50`}
    >
      {src ? (
        <img
          src={src}
          alt={`${name}'s profile`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </div>
  );
}

function PostSkeleton({ index }: { index: number }) {
  return (
    <div
      className="animate-pulse rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-4"
      aria-hidden="true"
      data-testid={`skeleton-wall-post-${index}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-white/10" />
        <div className="space-y-2">
          <div className="h-3 w-28 rounded-full bg-white/10" />
          <div className="h-2.5 w-20 rounded-full bg-white/[0.07]" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-3 w-full rounded-full bg-white/[0.08]" />
        <div className="h-3 w-4/5 rounded-full bg-white/[0.08]" />
      </div>
      <div className="mt-5 h-40 rounded-2xl bg-white/[0.06]" />
      <div className="mt-4 h-8 w-2/3 rounded-full bg-white/[0.06]" />
    </div>
  );
}

function WallPost({
  post,
  likeBusy,
  onLike,
  onShare,
  onOpenPostDetail,
}: {
  post: FriendWallPostView;
  likeBusy: boolean;
  onLike: (postId: string, reactionType?: string) => void;
  onShare: (postId: string) => void;
  onOpenPostDetail: (postId: string) => void;
}) {
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  useDismissableReactionPicker(
    reactionPickerOpen,
    () => setReactionPickerOpen(false),
    "friend-wall-post",
  );
  const created = formatDate(post.createdAt);
  const video = isVideoPost(post);
  const images = (post.imageUrls ?? []).filter(Boolean);
  if (!video && images.length === 0 && post.mediaUrl) images.push(post.mediaUrl);
  const hasMedia = video ? Boolean(post.mediaUrl) : images.length > 0;

  return (
    <article
      onClick={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("button, a, input, textarea, select, video, [role='button'], [data-no-post-open]")
        ) {
          return;
        }
        onOpenPostDetail(post.id);
      }}
      className="profile-nav-post overflow-hidden rounded-[1.4rem] border border-white/[0.09] bg-[linear-gradient(145deg,rgba(255,255,255,0.065),rgba(255,255,255,0.025)_55%,rgba(124,58,237,0.045))] shadow-[0_14px_35px_rgba(8,4,18,0.12)]"
      data-testid={`card-wall-post-${post.id}`}
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-5">
        <Avatar name={post.authorName} src={post.authorAvatarUrl} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[13px] font-extrabold tracking-[-0.01em] text-white/90"
            data-testid={`text-post-author-${post.id}`}
          >
            {post.authorName}
          </p>
          <time
            dateTime={created.dateTime}
            className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-violet-100/45"
            data-testid={`text-post-date-${post.id}`}
          >
            <Clock3 size={11} aria-hidden="true" />
            {created.label}
          </time>
        </div>
      </div>

      {post.content.trim() && (
        <p
          className="whitespace-pre-wrap break-words px-4 pb-4 text-[13px] leading-[1.7] text-violet-50/80 sm:px-5 sm:text-sm"
          data-testid={`text-post-content-${post.id}`}
        >
          {post.content}
        </p>
      )}

      {hasMedia && (
        <div className="profile-nav-post-media px-3 pb-3 sm:px-4">
          {video ? (
            <div className="overflow-hidden rounded-[1rem] border border-white/10 bg-black/30">
              {post.mediaUrl && (
                <AutoPlayMutedVideo
                  src={post.mediaUrl}
                  controls
                  passThroughClicks={false}
                  ariaLabel={`Video shared by ${post.authorName}`}
                  className="max-h-[26rem] w-full bg-black object-contain"
                  preload="none"
                  autoplayWithSound
                />
              )}
            </div>
          ) : (
            <div
              className={`grid gap-1.5 overflow-hidden rounded-[1rem] border border-white/10 bg-black/20 ${
                images.length === 1 ? "grid-cols-1" : "grid-cols-2"
              }`}
              data-testid={`gallery-post-media-${post.id}`}
            >
              {images.slice(0, 4).map((url, index) => (
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Photo ${index + 1} shared by ${post.authorName}`}
                  loading="lazy"
                  decoding="async"
                  className={`max-h-[24rem] min-h-32 w-full object-cover ${
                    images.length === 3 && index === 0 ? "row-span-2 h-full" : ""
                  } ${images.length === 1 ? "max-h-[30rem]" : ""}`}
                />
              ))}
              {images.length > 4 && (
                <div className="flex min-h-32 items-center justify-center bg-[#170f23] text-sm font-bold text-white/75">
                  +{images.length - 4} more photos
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="profile-nav-post-stats mx-4 flex items-center justify-between border-b border-white/[0.07] py-2 text-[10px] font-medium text-violet-100/45 sm:mx-5">
        <span data-testid={`text-post-likes-${post.id}`}>
          {countLabel(post.likesCount, "reaction")}
          {post.likedByCurrentUser && (
            <span className="ml-1" aria-label="Your reaction">
              {post.reactionType === "love" ? "❤️" : post.reactionType === "haha" ? "😂" : post.reactionType === "fire" ? "🔥" : post.reactionType === "wow" ? "😮" : "👍"}
            </span>
          )}
        </span>
        <span className="flex items-center">
          <button
            type="button"
            onClick={() => onOpenPostDetail(post.id)}
            aria-label={`Open ${post.commentsCount} comments`}
            data-testid={`text-post-comments-${post.id}`}
            className="rounded px-1 py-0.5 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            {countLabel(post.commentsCount, "comment")}
          </button>
        </span>
      </div>

      <div className="profile-nav-post-actions grid grid-cols-4 gap-1 px-2 py-2 sm:px-3">
        <div className="relative flex min-w-0 items-stretch">
          <button
            type="button"
            onClick={() =>
              onLike(
                post.id,
                post.likedByCurrentUser ? post.reactionType || "like" : "like",
              )
            }
            disabled={likeBusy}
            aria-label={`${post.likedByCurrentUser ? "Remove your reaction from" : "Like"} ${post.authorName}'s post`}
            aria-pressed={post.likedByCurrentUser}
            aria-busy={likeBusy}
            data-testid={`button-like-post-${post.id}`}
            className={`flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-l-xl px-1 text-[11px] font-bold transition-colors hover:bg-white/[0.07] active:scale-[0.98] ${
              post.likedByCurrentUser ? "text-pink-300" : "text-violet-100/65"
            }`}
          >
            <span aria-hidden="true">
              {post.likedByCurrentUser
                ? post.reactionType === "love" ? "❤️" : post.reactionType === "haha" ? "😂" : post.reactionType === "fire" ? "🔥" : post.reactionType === "wow" ? "😮" : "👍"
                : <Heart size={15} strokeWidth={2.2} />}
            </span>
            {post.likedByCurrentUser ? "Reacted" : "Like"}
          </button>
          <button
            type="button"
            onClick={() => setReactionPickerOpen((open) => !open)}
            data-reaction-surface="friend-wall-post"
            aria-label="Choose a post reaction"
            aria-expanded={reactionPickerOpen}
            className="flex min-h-10 w-7 shrink-0 items-center justify-center rounded-r-xl text-violet-100/55 transition-colors hover:bg-white/[0.07]"
          >
            <ChevronDown size={13} />
          </button>
          {reactionPickerOpen && (
            <div
              className="absolute bottom-full left-0 z-50 mb-2"
              data-reaction-surface="friend-wall-post"
            >
              <ReactionBar
                onReact={(emoji) => {
                  const reactionType = REACTION_TYPE_BY_EMOJI[emoji];
                  if (reactionType) onLike(post.id, reactionType);
                  setReactionPickerOpen(false);
                }}
                onClose={() => setReactionPickerOpen(false)}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenPostDetail(post.id)}
          aria-label={`Open comments for ${post.authorName}'s post`}
          data-testid={`button-comments-post-${post.id}`}
          className="flex min-h-10 items-center justify-center gap-2 rounded-xl text-[11px] font-bold text-violet-100/65 transition-colors hover:bg-white/[0.07] active:scale-[0.98]"
        >
          <MessageCircle size={15} strokeWidth={2.1} aria-hidden="true" />
          Comment
        </button>
        <button
          type="button"
          onClick={() => onShare(post.id)}
          aria-label={`Share ${post.authorName}'s post`}
          data-testid={`button-share-post-${post.id}`}
          className="flex min-h-10 items-center justify-center gap-2 rounded-xl text-[11px] font-bold text-violet-100/65 transition-colors hover:bg-white/[0.07] active:scale-[0.98]"
        >
          <Share2 size={15} strokeWidth={2.1} aria-hidden="true" />
          Share
        </button>
        <SavePostButton postId={post.id} className="profile-nav-save-button" />
      </div>
    </article>
  );
}

export default function FriendWallPresentation({
  friendName,
  canPost,
  posts,
  loading,
  error,
  likeBusyPostId,
  onOpenComposer,
  isOwnProfile = false,
  onCreateHook,
  onLike,
  onShare,
  onOpenPostDetail,
  onRetry,
}: FriendWallPresentationProps) {
  return (
    <section
      aria-label={`${friendName}'s wall`}
      className="profile-nav-wall-section px-4 pb-7 pt-6 sm:px-5"
      data-testid="section-friend-wall"
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-cyan-200/55">
            A little more personal
          </p>
          <h3 className="mt-1 text-lg font-black tracking-[-0.035em] text-white">
            {friendName}&apos;s wall
          </h3>
        </div>
        <span className="mb-0.5 hidden items-center gap-1.5 text-[10px] font-semibold text-violet-100/40 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/80" aria-hidden="true" />
          Friends, in their own words
        </span>
      </div>

      {canPost ? (
        <div className={`mb-4 grid gap-2 sm:mb-5 ${isOwnProfile && onCreateHook ? "grid-cols-[minmax(0,1fr)_auto]" : ""}`}>
          <button
            type="button"
            onClick={onOpenComposer}
            data-testid="button-open-wall-composer"
            className="group flex min-h-14 w-full items-center gap-3 rounded-[1.25rem] border border-fuchsia-200/15 bg-gradient-to-r from-fuchsia-300/[0.085] via-violet-300/[0.06] to-cyan-200/[0.06] p-3 text-left transition-colors hover:border-fuchsia-200/25 hover:bg-white/[0.07] active:scale-[0.995] sm:p-3.5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-fuchsia-100/80 transition-colors group-hover:bg-fuchsia-300/15">
              <PenLine size={17} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold text-white/85">
                {isOwnProfile ? "What's on your mind?" : `Write something on ${friendName}'s timeline...`}
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-medium text-violet-100/42">
                A thought, a photo, or a quick hello
              </span>
            </span>
            {!isOwnProfile && (
              <span className="pr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-fuchsia-200/70">
                Write
              </span>
            )}
          </button>
          {isOwnProfile && onCreateHook && (
            <button
              type="button"
              onClick={onCreateHook}
              data-testid="button-create-hook"
              aria-label="Create a Movement short video"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] border border-lime-200/25 bg-lime-300/10 px-3 text-xs font-extrabold text-lime-100 transition-colors hover:bg-lime-300/20 active:scale-[0.98]"
            >
              <Video size={16} aria-hidden="true" />
              <span>Create Movement</span>
            </button>
          )}
        </div>
      ) : (
        <div
          className="mb-4 flex items-center gap-3 rounded-[1.25rem] border border-white/[0.07] bg-white/[0.03] px-3 py-3 sm:mb-5"
          data-testid="status-wall-posting-unavailable"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.04] text-violet-100/35">
            <LockKeyhole size={16} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[12px] font-bold text-violet-50/60">Posting is for friends</span>
            <span className="mt-0.5 block text-[10px] font-medium text-violet-100/35">
              You can still read and react to {friendName}&apos;s posts.
            </span>
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3.5" aria-busy="true" aria-label="Loading wall posts">
          <PostSkeleton index={1} />
          <PostSkeleton index={2} />
        </div>
      ) : error ? (
        <div
          className="rounded-[1.35rem] border border-rose-200/15 bg-rose-300/[0.055] px-5 py-7 text-center"
          role="alert"
          data-testid="status-wall-error"
        >
          <p className="text-sm font-bold text-rose-100/85">The wall didn&apos;t load.</p>
          <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-rose-100/50">
            {error || "Please try again in a moment."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            data-testid="button-retry-wall"
            className="mx-auto mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-100/15 bg-white/[0.05] px-4 text-xs font-bold text-rose-50/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/40"
          >
            <RotateCw size={14} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div
          className="relative overflow-hidden rounded-[1.4rem] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] px-5 py-8 text-center sm:py-10"
          data-testid="status-wall-empty"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100/10 bg-cyan-200/[0.06] text-cyan-100/65">
            {canPost ? <ImageIcon size={20} aria-hidden="true" /> : <Video size={20} aria-hidden="true" />}
          </span>
          <p className="mt-4 text-sm font-bold text-white/85">A fresh page, for now.</p>
          <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-violet-100/45">
            {canPost
              ? `Be the first to leave something kind on ${friendName}'s wall.`
              : `${friendName} hasn't shared anything on their wall yet.`}
          </p>
          {canPost && (
            <button
              type="button"
              onClick={onOpenComposer}
              data-testid="button-write-first-wall-post"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-fuchsia-300/15 px-4 text-xs font-bold text-fuchsia-100 transition-colors hover:bg-fuchsia-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200/40"
            >
              <PenLine size={14} aria-hidden="true" />
              Write the first note
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5 sm:space-y-4" data-testid="list-friend-wall-posts">
          {posts.map((post) => (
            <WallPost
              key={post.id}
              post={post}
              likeBusy={likeBusyPostId === post.id}
              onLike={onLike}
              onShare={onShare}
              onOpenPostDetail={onOpenPostDetail}
            />
          ))}
        </div>
      )}
    </section>
  );
}
