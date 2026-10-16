import {
  Bookmark,
  CalendarDays,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react";
import SavePostButton from "../SavePostButton";

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

export type SavedItemsViewProps = {
  posts: SavedPost[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpenPost: (postId: string) => void;
  onUnsave: (postId: string) => void;
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { label: "Recently", dateTime: undefined };
  }

  return {
    label: new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    }).format(date),
    dateTime: date.toISOString(),
  };
}

function countLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function isVideoPost(post: SavedPost) {
  const kind = post.type?.toLowerCase() ?? "";
  const url = post.mediaUrl?.split("?")[0] ?? "";
  return kind.includes("video") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(url);
}

function PostSkeleton({ index }: { index: number }) {
  return (
    <div
      aria-hidden="true"
      data-testid={`skeleton-saved-post-${index}`}
      className="overflow-hidden rounded-[1.4rem] border border-[#e9e9d8] bg-white p-5 shadow-[0_8px_26px_rgba(70,76,36,0.045)]"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[#eff0d9]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 animate-pulse rounded-full bg-[#eff0d9]" />
          <div className="h-2.5 w-20 animate-pulse rounded-full bg-[#f3f3e8]" />
        </div>
        <div className="h-9 w-9 animate-pulse rounded-full bg-[#f3f3e8]" />
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-[#f0f0e3]" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-[#f0f0e3]" />
      </div>
      <div className="mt-5 h-48 animate-pulse rounded-[1.05rem] bg-[#f2f2e6]" />
    </div>
  );
}

function SavedPostCard({
  post,
  onOpenPost,
  onUnsave,
}: {
  post: SavedPost;
  onOpenPost: (postId: string) => void;
  onUnsave: (postId: string) => void;
}) {
  const created = formatDate(post.createdAt);
  const saved = formatDate(post.savedAt);
  const video = isVideoPost(post);
  const images = (post.imageUrls ?? []).filter(Boolean);

  if (!video && images.length === 0 && post.mediaUrl) images.push(post.mediaUrl);
  if (!video && images.length === 0 && post.coverUrl) images.push(post.coverUrl);

  return (
    <article
      data-testid={`card-saved-post-${post.id}`}
      className="group overflow-hidden rounded-[1.45rem] border border-[#e8e9d8] bg-white shadow-[0_8px_28px_rgba(70,76,36,0.055)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(70,76,36,0.09)]"
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <button
          type="button"
          onClick={() => onOpenPost(post.id)}
          aria-label={`Open post by ${post.author}`}
          data-testid={`button-open-post-${post.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[#a3a957] focus-visible:ring-offset-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e7e9cf] bg-[#e9ebcf] text-[11px] font-extrabold tracking-wide text-[#555d2d]">
            {post.avatarUrl ? (
              <img
                src={post.avatarUrl}
                alt={`${post.author}'s profile`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden="true">{initials(post.author)}</span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-[13px] font-bold tracking-[-0.02em] text-[#303522]"
              data-testid={`text-post-author-${post.id}`}
            >
              {post.author}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-medium text-[#85886d]">
              <time dateTime={created.dateTime}>{created.label}</time>
              <span aria-hidden="true">·</span>
              <span>Saved to your collection</span>
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden items-center gap-1.5 rounded-full bg-[#f5f5e9] px-2.5 py-1.5 text-[9px] font-bold text-[#777b5d] sm:inline-flex">
            <CalendarDays size={11} aria-hidden="true" />
            Saved {saved.label}
          </span>
          <SavePostButton
            postId={post.id}
            onToggled={(isSaved) => {
              if (!isSaved) onUnsave(post.id);
            }}
            className="!min-h-10 !min-w-10 !border !border-[#e8e9d8] !bg-[#59613a] !text-white hover:!bg-[#454d2e] focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-[#a3a957]"
          />
        </div>
      </div>

      {post.content.trim() && (
        <button
          type="button"
          onClick={() => onOpenPost(post.id)}
          data-testid={`button-open-post-content-${post.id}`}
          className="block w-full px-4 pb-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a3a957] sm:px-5"
        >
          <span
            className="block whitespace-pre-wrap break-words text-[13px] leading-[1.75] text-[#4e5140] sm:text-sm"
            data-testid={`text-post-content-${post.id}`}
          >
            {post.content}
          </span>
          {images.length > 0 && (
            <span
              className={`mt-4 grid gap-1.5 overflow-hidden rounded-[1.05rem] bg-[#f2f2e8] ${
                images.length === 1 ? "grid-cols-1" : "grid-cols-2"
              }`}
              data-testid={`gallery-saved-post-${post.id}`}
            >
              {images.slice(0, 4).map((url, index) => (
                <span
                  key={`${url}-${index}`}
                  className={`relative block min-h-28 overflow-hidden bg-[#edeee0] ${
                    images.length === 1 ? "max-h-[30rem]" : "aspect-[1.2]"
                  } ${images.length === 3 && index === 0 ? "row-span-2 h-full" : ""}`}
                >
                  <img
                    src={url}
                    alt={`Photo ${index + 1} shared by ${post.author}`}
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015] ${
                      images.length === 1 ? "max-h-[30rem]" : ""
                    }`}
                  />
                </span>
              ))}
              {images.length > 4 && (
                <span className="flex min-h-28 items-center justify-center bg-[#f0f0e3] text-xs font-semibold text-[#686d49]">
                  +{images.length - 4} more photos
                </span>
              )}
            </span>
          )}
        </button>
      )}

      {video && post.mediaUrl && (
        <div className="px-4 pb-4 sm:px-5">
          <div className="overflow-hidden rounded-[1.05rem] border border-[#e9e9df] bg-[#272a20]">
            <video
              src={post.mediaUrl}
              poster={post.coverUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              aria-label={`Video shared by ${post.author}`}
              data-testid={`video-saved-post-${post.id}`}
              className="max-h-[30rem] w-full bg-[#272a20] object-contain"
            />
          </div>
        </div>
      )}

      {!post.content.trim() && images.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenPost(post.id)}
          aria-label={`Open photos shared by ${post.author}`}
          data-testid={`button-open-post-media-${post.id}`}
          className="block w-full px-4 pb-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a3a957] sm:px-5"
        >
          <span
            className={`grid gap-1.5 overflow-hidden rounded-[1.05rem] bg-[#f2f2e8] ${
              images.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {images.slice(0, 4).map((url, index) => (
              <span
                key={`${url}-${index}`}
                className={`block min-h-28 overflow-hidden bg-[#edeee0] ${
                  images.length === 1 ? "max-h-[30rem]" : "aspect-[1.2]"
                }`}
              >
                <img
                  src={url}
                  alt={`Photo ${index + 1} shared by ${post.author}`}
                  loading="lazy"
                  decoding="async"
                  className={`h-full w-full object-cover ${
                    images.length === 1 ? "max-h-[30rem]" : ""
                  }`}
                />
              </span>
            ))}
            {images.length > 4 && (
              <span className="flex min-h-28 items-center justify-center bg-[#f0f0e3] text-xs font-semibold text-[#686d49]">
                +{images.length - 4} more photos
              </span>
            )}
          </span>
        </button>
      )}

      <div className="mx-4 flex items-center justify-between border-t border-[#efefe5] py-3 text-[10px] font-medium text-[#85886d] sm:mx-5">
        <span className="inline-flex items-center gap-1.5" data-testid={`text-post-likes-${post.id}`}>
          <Heart size={12} aria-hidden="true" />
          {countLabel(post.likesCount, "like")}
        </span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5" data-testid={`text-post-comments-${post.id}`}>
            <MessageCircle size={12} aria-hidden="true" />
            {countLabel(post.commentsCount, "comment")}
          </span>
          <span className="inline-flex items-center gap-1.5" data-testid={`text-post-shares-${post.id}`}>
            <Share2 size={12} aria-hidden="true" />
            {countLabel(post.sharesCount, "share")}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-4 text-[10px] font-medium text-[#92947b] sm:px-5">
        <Bookmark size={11} className="text-[#858b50]" aria-hidden="true" />
        Added to your saved items on{" "}
        <time dateTime={saved.dateTime} data-testid={`text-post-saved-date-${post.id}`}>
          {saved.label}
        </time>
      </div>
    </article>
  );
}

export default function SavedItemsView({
  posts,
  loading,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpenPost,
  onUnsave,
}: SavedItemsViewProps) {
  const showInitialLoading = loading && posts.length === 0;

  return (
    <main className="min-h-[100dvh] bg-[#f7f8ed] px-4 pb-16 pt-7 text-[#303522] sm:px-6 sm:pt-10">
      <div className="mx-auto w-full max-w-[1040px]">
        <header className="relative mb-7 overflow-hidden rounded-[1.65rem] border border-[#e9eaca] bg-[#f1f2d5] px-5 py-6 sm:mb-9 sm:px-9 sm:py-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-[#d9dda9] opacity-70 sm:-right-2 sm:-top-36 sm:h-[25rem] sm:w-[25rem]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-1 top-10 h-32 w-32 rounded-full border border-[#d9dda9]/80 sm:right-20 sm:top-12 sm:h-48 sm:w-48"
          />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfe2b6] bg-[#f8f9e9]/75 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#717747]">
              <Bookmark size={11} aria-hidden="true" />
              Your collection
            </div>
            <h1 className="mt-4 font-semibold tracking-[-0.055em] text-[#343a25] text-[clamp(2.15rem,6vw,3.45rem)] leading-[0.98]">
              Saved items
            </h1>
            <p className="mt-3 max-w-md text-[13px] leading-6 text-[#696d53] sm:text-sm">
              Good moments from your friends, gathered here for whenever you want to come back.
            </p>
            {!loading && posts.length > 0 && (
              <p
                className="mt-5 inline-flex items-center gap-2 text-[10px] font-semibold text-[#777b5d]"
                data-testid="text-saved-post-count"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#a4aa5b]" aria-hidden="true" />
                Showing {posts.length} {posts.length === 1 ? "post" : "posts"}
              </p>
            )}
          </div>
        </header>

        <section aria-label="Your saved posts">
          {loading && posts.length > 0 && (
            <div
              role="status"
              data-testid="status-saved-loading"
              className="mb-4 flex items-center gap-2 text-[11px] font-medium text-[#7b805f]"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#a3aa5c]" aria-hidden="true" />
              Updating your saved items
            </div>
          )}

          {error && (
            <div
              role="alert"
              data-testid="status-saved-error"
              className="mb-5 rounded-2xl border border-[#e7d7c4] bg-[#fff9ef] px-5 py-4"
            >
              <p className="text-sm font-bold text-[#514433]">Your saved items couldn’t load.</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[#81725e]">
                {error || "Please check back in a moment."}
              </p>
            </div>
          )}

          {showInitialLoading ? (
            <div
              aria-busy="true"
              aria-label="Loading saved items"
              data-testid="status-saved-loading"
              className="grid gap-4"
            >
              <PostSkeleton index={1} />
              <PostSkeleton index={2} />
            </div>
          ) : !error && posts.length === 0 ? (
            <div
              data-testid="status-saved-empty"
              className="relative overflow-hidden rounded-[1.55rem] border border-[#e7e8d5] bg-white px-5 py-10 text-center shadow-[0_8px_26px_rgba(70,76,36,0.045)] sm:py-14"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-[#e7e9ca] bg-[#f2f3dc] text-[#747b45]">
                <Bookmark size={22} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-lg font-bold tracking-[-0.035em] text-[#3b402b]">
                Your collection starts here
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[12px] leading-6 text-[#777b64] sm:text-[13px]">
                Save a post from a friend and it’ll be waiting here when you need it.
              </p>
            </div>
          ) : (
            posts.length > 0 && (
              <div className="grid gap-4 sm:gap-5" data-testid="list-saved-posts">
                {posts.map((post) => (
                  <SavedPostCard
                    key={post.id}
                    post={post}
                    onOpenPost={onOpenPost}
                    onUnsave={onUnsave}
                  />
                ))}
              </div>
            )
          )}

          {error && posts.length === 0 && !loading && (
            <div className="rounded-2xl border border-[#e7e8d5] bg-white/80 px-5 py-5 text-center">
              <p className="text-xs text-[#777b64]">Your saved posts will appear here once they’re available.</p>
            </div>
          )}

          {(hasMore || loadingMore) && !showInitialLoading && (
            <div className="mt-6 flex flex-col items-center gap-2" data-testid="section-load-more">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                aria-busy={loadingMore}
                data-testid="button-load-more"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#dfe1c7] bg-white px-5 text-xs font-bold text-[#535a36] shadow-[0_3px_10px_rgba(70,76,36,0.04)] transition-[transform,background-color,box-shadow] hover:bg-[#fbfbea] hover:shadow-[0_6px_16px_rgba(70,76,36,0.08)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9fa653] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
              >
                {loadingMore ? (
                  <>
                    <span className="h-3 w-3 animate-pulse rounded-full bg-[#9fa653]" aria-hidden="true" />
                    Loading more
                  </>
                ) : (
                  "Show more saved posts"
                )}
              </button>
              {loadingMore && (
                <span role="status" data-testid="status-load-more-loading" className="sr-only">
                  Loading more saved posts
                </span>
              )}
            </div>
          )}
          {!hasMore && posts.length > 0 && !loadingMore && (
            <p
              data-testid="status-load-more-end"
              className="mt-7 text-center text-[10px] font-medium tracking-wide text-[#92947b]"
            >
              You’re all caught up
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
