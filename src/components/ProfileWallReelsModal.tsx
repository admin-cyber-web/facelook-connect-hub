import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, X } from "lucide-react";
import { useHlsVideo } from "@/hooks/useHlsVideo";
import { getBunnyVideoThumbnailUrl } from "@/hooks/useBunnyVideoStatus";
import type { FriendWallPostView } from "./FriendWallPresentation";

type Props = {
  posts: FriendWallPostView[];
  initialIndex: number;
  onClose: () => void;
  onLike: (postId: string, reactionType?: string) => void;
  onComments: (postId: string) => void;
  onShare: (postId: string) => void;
};

function ReelVideo({
  post,
  active,
  near,
}: {
  post: FriendWallPostView;
  active: boolean;
  near: boolean;
}) {
  const src = post.videoUrl || post.mediaUrl || "";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const playback = useHlsVideo(videoRef, src, near, undefined, active, near && !active);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      return;
    }
    if (!playback.isHls) void video.play().catch(() => {});
  }, [active, playback.isHls]);

  return (
    <>
      <video
        ref={videoRef}
        src={playback.isHls ? undefined : src}
        poster={post.coverUrl || getBunnyVideoThumbnailUrl(src)}
        className="absolute inset-0 h-full w-full bg-black object-contain"
        loop
        playsInline
        muted={muted}
        autoPlay={active}
        preload={near ? "auto" : "none"}
        crossOrigin="anonymous"
        aria-label={`Video shared by ${post.authorName}`}
      />
      {playback.error && (
        <p className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sm text-white/75">
          Video could not be loaded.
        </p>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          const nextMuted = !muted;
          setMuted(nextMuted);
          const video = videoRef.current;
          if (video) {
            video.muted = nextMuted;
            if (active) void video.play().catch(() => {});
          }
        }}
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        className="absolute right-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
      >
        {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
      </button>
    </>
  );
}

export default function ProfileWallReelsModal({
  posts,
  initialIndex,
  onClose,
  onLike,
  onComments,
  onShare,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(initialIndex);
  const scrollFrameRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTop = initialIndex * scroller.clientHeight;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, [initialIndex]);

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const scroller = scrollerRef.current;
      if (!scroller || scroller.clientHeight === 0) return;
      const nextIndex = Math.min(
        posts.length - 1,
        Math.max(0, Math.round(scroller.scrollTop / scroller.clientHeight)),
      );
      if (nextIndex === activeIndexRef.current) return;
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    });
  }, [posts.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex = Math.min(
          posts.length - 1,
          Math.max(0, activeIndexRef.current + (event.key === "ArrowDown" ? 1 : -1)),
        );
        scrollerRef.current?.scrollTo({
          top: nextIndex * (scrollerRef.current?.clientHeight ?? 0),
          behavior: "smooth",
        });
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, posts.length]);

  if (posts.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110000] bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Profile videos"
      data-testid="modal-profile-wall-reels"
    >
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="h-[100dvh] overflow-y-auto overscroll-contain snap-y snap-mandatory"
        style={{ touchAction: "pan-y" }}
      >
        {posts.map((post, index) => {
          const src = post.videoUrl || post.mediaUrl || "";
          const isNear = Math.abs(index - activeIndex) <= 1;
          const authorInitials = post.authorName
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("");

          return (
            <section
              key={post.id}
              className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden bg-black"
              aria-label={`Video ${index + 1} of ${posts.length}`}
            >
              {isNear && src ? (
                <ReelVideo post={post} active={index === activeIndex} near={isNear} />
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/75" />

              <button
                type="button"
                onClick={onClose}
                aria-label="Close profile videos"
                className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
              >
                <X size={21} />
              </button>
              <span className="absolute right-5 top-[max(1.35rem,env(safe-area-inset-top))] z-20 rounded-full bg-black/40 px-3 py-1 text-xs font-bold text-white/85 backdrop-blur">
                {index + 1} / {posts.length}
              </span>

              <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 z-10 max-w-[calc(100%-5.5rem)] sm:left-8">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/35 bg-white/15 text-xs font-black text-white">
                    {post.authorAvatarUrl ? (
                      <img
                        src={post.authorAvatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      authorInitials
                    )}
                  </div>
                  <span className="max-w-[min(65vw,20rem)] truncate text-sm font-extrabold text-white drop-shadow">
                    {post.authorName}
                  </span>
                </div>
                {post.content.trim() && (
                  <p className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-white/95 drop-shadow">
                    {post.content}
                  </p>
                )}
              </div>

              <div className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] right-4 z-10 flex flex-col items-center gap-5">
                <button
                  type="button"
                  onClick={() =>
                    onLike(
                      post.id,
                      post.likedByCurrentUser ? post.reactionType || "like" : "like",
                    )
                  }
                  aria-label={post.likedByCurrentUser ? "Remove like" : "Like video"}
                  aria-pressed={post.likedByCurrentUser}
                  className="flex min-w-12 flex-col items-center gap-1 text-white drop-shadow"
                >
                  <Heart
                    size={29}
                    fill={post.likedByCurrentUser ? "currentColor" : "none"}
                    className={post.likedByCurrentUser ? "text-pink-400" : ""}
                  />
                  <span className="text-xs font-bold">{post.likesCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onComments(post.id);
                    onClose();
                  }}
                  aria-label={`Open ${post.commentsCount} comments`}
                  className="flex min-w-12 flex-col items-center gap-1 text-white drop-shadow"
                >
                  <MessageCircle size={28} />
                  <span className="text-xs font-bold">{post.commentsCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onShare(post.id)}
                  aria-label="Share video"
                  className="flex min-w-12 flex-col items-center gap-1 text-white drop-shadow"
                >
                  <Share2 size={27} />
                  <span className="text-xs font-bold">{post.sharesCount}</span>
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
