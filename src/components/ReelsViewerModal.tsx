import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, MessageCircle, Share2, MoreVertical } from "lucide-react";
import { toast } from "sonner";

interface ReelsViewerModalProps {
  src: string;
  post: any;
  onClose: () => void;
  index?: number;
  count?: number;
}

export default function ReelsViewerModal({
  src,
  post,
  onClose,
  index,
  count,
}: ReelsViewerModalProps) {
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("click", () => {
      setIsMuted((prev) => {
        const next = !prev;
        video.muted = next;
        return next;
      });
    });
    return () => video.removeEventListener("click", () => {});
  }, [video]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] bg-black/98 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Reels viewer"
    >
      <div className="relative h-screen w-full flex items-center justify-center">
        <div className="relative w-full aspect-[16/9] bg-black">
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            muted={isMuted}
            playsInline
            webkitPlaysInline
            autoplay
            loop
            aria-label={`Reels video ${index !== undefined ? index + 1 : 1}`}
          >
            <source
              src={src}
              type={src.includes(".mp4") ? "video/mp4" : src.includes(".webm") ? "video/webm" : ""}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <svg className="h-20 w-20 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span className="ml-2 text-white/70 text-sm">Video</span>
            </div>
          </video>
        </div>

        <button onClick={onClose} className="absolute top-4 left-4 z-50 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="absolute bottom-6 left-1/2 -translate-x-6 flex flex-wrap gap-2 px-3 pb-2 bg-black/60 rounded-b-2L">
          <button onClick={(e) => { e.stopPropagation(); toast.success("Liked!"); }} className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition" aria-label="Like">
            <Heart className="h-3 w-3" /><span>Like</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); toast.success("Liked!"); }} className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition" aria-label="Like">
            <Heart className="h-3 w-3" /><span>Like</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); toast.info("Comment"); }} className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition" aria-label="Comment">
            <MessageCircle className="h-3 w-3" /><span>Comment</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); toast.success("Shared!"); }} className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition" aria-label="Share">
            <Share2 className="h-3 w-3" /><span>Share</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); toast.info("More options"); }} className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition" aria-label="More">
            <MoreVertical className="h-3 w-3" /><span>More</span>
          </button>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-6 flex items-center gap-3 bg-white/20 rounded-full p-2 backdrop-blur-sm text-white/90" style={{ maxWidth: "calc(100% - 2rem)" }}>
          <img src={post.author_avatar_url || "/placeholder-avatar.png"} alt="author" className="w-10 h-10 rounded-full object-cover border-2 border-white/20" />
          <span className="font-medium truncate">{post.author_name || "Unknown"}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}