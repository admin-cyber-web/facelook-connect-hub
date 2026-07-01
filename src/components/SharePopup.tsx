import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Share2, Check, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  universalShare,
  resolveShareMediaUrl,
  type PostType,
  type ShareOutcome,
} from "../lib/universalShare";

// ── Public types ──────────────────────────────────────────────────────────────

export interface SharePostData {
  id: string;
  title?: string;
  content?: string;
  media_url?: string;
  cover_url?: string;
  meta_image?: string;
  type?: string;
  author?: string;
  meta_title?: string;
  meta_description?: string;
  shares_count?: number;
}

export interface ShareAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ShareMode =
  | "copy"
  | "whatsapp"
  | "messenger"
  | "facebook"
  | "instagram"
  | "twitter"
  | "telegram"
  | "system";

interface SharePopupProps {
  post: SharePostData;
  anchor: ShareAnchor;
  onClose: () => void;
  onShare: (mode: ShareMode, post: SharePostData) => void;
  /** Pass canvasRef.current for QuotesMaker canvas-based sharing */
  canvas?: HTMLCanvasElement | null;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const POPUP_WIDTH = 272;
const POPUP_HEIGHT = 360; // taller to accommodate media-share button
const MARGIN = 12;

function calcPosition(anchor: ShareAnchor): {
  top: number;
  left: number;
  above: boolean;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const anchorCenterX = anchor.x + anchor.width / 2;
  const anchorBottom = anchor.y + anchor.height;
  const anchorTop = anchor.y;
  const spaceBelow = vh - anchorBottom - MARGIN;
  const spaceAbove = anchorTop - MARGIN;
  const above = spaceBelow < POPUP_HEIGHT && spaceAbove > spaceBelow;
  let top = above ? anchorTop - POPUP_HEIGHT - 8 : anchorBottom + 8;
  let left = anchorCenterX - POPUP_WIDTH / 2;
  left = Math.max(MARGIN, Math.min(left, vw - POPUP_WIDTH - MARGIN));
  top = Math.max(MARGIN, Math.min(top, vh - POPUP_HEIGHT - MARGIN));
  return { top, left, above };
}

// ── Platform link options (URL-only deep links) ───────────────────────────────

const PLATFORM_OPTIONS: {
  mode: ShareMode;
  label: string;
  bg: string;
  icon: React.ReactNode;
}[] = [
  {
    mode: "whatsapp",
    label: "WhatsApp",
    bg: "#25D366",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.306A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.95 7.95 0 01-4.076-1.117l-.292-.174-3.017.791.806-2.94-.19-.302A7.95 7.95 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z" />
      </svg>
    ),
  },
  {
    mode: "messenger",
    label: "Messenger",
    bg: "linear-gradient(135deg, #0084ff, #a334fa)",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
        <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.922 1.32 5.532 3.407 7.326V22l3.115-1.708c.831.23 1.712.354 2.624.354 5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.012 12.44l-2.544-2.714-4.967 2.714 5.469-5.8 2.608 2.714 4.903-2.714-5.469 5.8z" />
      </svg>
    ),
  },
  {
    mode: "facebook",
    label: "Facebook",
    bg: "#1877F2",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.532-4.669 1.313 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
  },
  {
    mode: "instagram",
    label: "Instagram",
    bg: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    mode: "twitter",
    label: "X / Twitter",
    bg: "#000000",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.631 5.903-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    mode: "telegram",
    label: "Telegram",
    bg: "#229ED9",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    mode: "copy",
    label: "Copy Link",
    bg: "rgba(255,255,255,0.12)",
    icon: <Link2 size={19} className="text-white" />,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

const SharePopup: React.FC<SharePopupProps> = ({
  post,
  anchor,
  onClose,
  onShare,
  canvas,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [mediaSharing, setMediaSharing] = useState(false);
  const [mediaOutcome, setMediaOutcome] = useState<ShareOutcome | null>(null);

  const { top, left, above } = calcPosition(anchor);

  const thumbnail = post.media_url || post.cover_url || null;
  const caption =
    post.meta_title || post.content?.slice(0, 72) || "Check this out on Flicks!";
  const shareUrl = `${window.location.origin}/?post=${post.id}`;

  // Resolve the best media URL for this post type
  const mediaUrl = canvas
    ? undefined
    : resolveShareMediaUrl({
        type: post.type,
        media_url: post.media_url,
        cover_url: post.cover_url,
        meta_image: post.meta_image,
      });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // ── Platform link buttons (URL-only) ──────────────────────────────────────
  const handlePlatformClick = (mode: ShareMode) => {
    if (mode === "copy") {
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1200);
    } else {
      onClose();
    }
    onShare(mode, post);
  };

  // ── File-based native share (opens OS sheet WITH the image/video) ─────────
  const handleMediaShare = async () => {
    if (mediaSharing) return;
    setMediaSharing(true);
    setMediaOutcome(null);

    const outcome = await universalShare({
      title:
        post.meta_title ||
        post.content?.slice(0, 60) ||
        "Check this out on Flicks!",
      text: post.content || "",
      url: shareUrl,
      mediaUrl,
      canvas: canvas ?? undefined,
      type: (post.type as PostType) || "post",
    });

    setMediaSharing(false);
    setMediaOutcome(outcome);

    if (outcome === "shared-with-file" || outcome === "shared-url-only") {
      // Increment share count via parent handler then close
      onShare("system", post);
      setTimeout(onClose, 300);
    } else if (outcome === "copied") {
      toast.success("Link copied to clipboard!");
      onShare("copy", post);
      setTimeout(onClose, 1200);
    } else if (outcome === "cancelled") {
      setMediaOutcome(null); // User cancelled — keep popup open
    } else {
      toast.error("Share failed. Try Copy Link instead.");
    }
  };

  const mediaButtonLabel = () => {
    if (mediaSharing) return "Preparing media…";
    if (mediaOutcome === "shared-with-file") return "Shared with image ✓";
    if (mediaOutcome === "shared-url-only") return "Shared ✓";
    if (mediaOutcome === "copied") return "Link copied ✓";
    const hasMedia = !!(canvas || mediaUrl);
    return hasMedia ? "Share with Image / Video" : "Share via…";
  };

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          key="share-popup-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[490]"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={onClose}
        />

        {/* Popup card */}
        <motion.div
          ref={popupRef}
          key="share-popup-panel"
          initial={{ opacity: 0, scale: 0.82, y: above ? 8 : -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.82, y: above ? 8 : -8 }}
          transition={{ type: "spring", damping: 22, stiffness: 380 }}
          className="fixed z-[500] select-none"
          style={{
            top,
            left,
            width: POPUP_WIDTH,
            background: "rgba(16, 4, 24, 0.96)",
            backdropFilter: "blur(28px) saturate(1.6)",
            WebkitBackdropFilter: "blur(28px) saturate(1.6)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 22,
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(139,0,80,0.2)",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Maroon gradient accent bar */}
          <div
            style={{
              height: 3,
              background:
                "linear-gradient(90deg,#8b0051,#c62a6e,#ff2d55,#ff6b35)",
            }}
          />

          {/* Post preview row */}
          <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2.5">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt=""
                className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
               decoding="async"/>
            ) : canvas ? (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                style={{
                  background: "rgba(139,0,81,0.3)",
                  border: "1px solid rgba(139,0,81,0.3)",
                }}
              >
                ✍️
              </div>
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(139,0,81,0.25)",
                  border: "1px solid rgba(139,0,81,0.3)",
                }}
              >
                <ImageIcon size={18} className="text-pink-400" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[11.5px] leading-snug line-clamp-2">
                {caption}
              </p>
              {post.author && (
                <p className="text-white/40 text-[10px] font-medium mt-0.5 truncate">
                  by {post.author}
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X size={13} className="text-white/50" />
            </button>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.07)",
              margin: "0 12px",
            }}
          />

          {/* ── "Share with Image" — file-based OS sheet ── */}
          <div className="px-3 pt-3 pb-1">
            <motion.button
              whileTap={mediaSharing ? {} : { scale: 0.97 }}
              onClick={handleMediaShare}
              disabled={mediaSharing}
              className="w-full flex items-center justify-center gap-2 rounded-[14px] py-2.5 px-4 font-bold text-[12px] transition-opacity"
              style={{
                background:
                  mediaOutcome === "shared-with-file" ||
                  mediaOutcome === "shared-url-only" ||
                  mediaOutcome === "copied"
                    ? "rgba(34,197,94,0.22)"
                    : mediaSharing
                      ? "rgba(255,255,255,0.06)"
                      : "linear-gradient(135deg,rgba(139,0,81,0.55),rgba(198,42,110,0.55))",
                border: "1px solid rgba(255,255,255,0.12)",
                color:
                  mediaOutcome === "shared-with-file" ||
                  mediaOutcome === "shared-url-only" ||
                  mediaOutcome === "copied"
                    ? "#4ade80"
                    : "rgba(255,255,255,0.9)",
                opacity: mediaSharing ? 0.75 : 1,
              }}
            >
              {mediaSharing ? (
                <Loader2 size={15} className="animate-spin text-white/70" />
              ) : mediaOutcome === "shared-with-file" ||
                mediaOutcome === "shared-url-only" ||
                mediaOutcome === "copied" ? (
                <Check size={15} />
              ) : (
                <Share2 size={15} />
              )}
              <span>{mediaButtonLabel()}</span>
            </motion.button>
            <p className="text-center text-white/30 text-[9px] mt-1.5 mb-0.5 leading-none">
              Opens your device share sheet · image attached
            </p>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.07)",
              margin: "6px 12px",
            }}
          />

          {/* Platform link grid (URL-only) */}
          <div className="grid grid-cols-4 gap-x-1 gap-y-3 px-3 pb-3.5 pt-1">
            {PLATFORM_OPTIONS.map(({ mode, label, bg, icon }) => {
              const isCopyDone = mode === "copy" && copied;
              return (
                <motion.button
                  key={mode}
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.06 }}
                  onClick={() => handlePlatformClick(mode)}
                  className="flex flex-col items-center gap-1.5 outline-none"
                >
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                    style={{
                      background: isCopyDone ? "rgba(34,197,94,0.25)" : bg,
                      border:
                        mode === "copy"
                          ? "1px solid rgba(255,255,255,0.12)"
                          : "none",
                      boxShadow:
                        mode !== "copy"
                          ? "0 3px 12px rgba(0,0,0,0.35)"
                          : "none",
                    }}
                  >
                    {isCopyDone ? (
                      <Check size={19} className="text-green-400" />
                    ) : (
                      icon
                    )}
                  </div>
                  <span className="text-white/55 font-medium leading-none text-[9.5px] text-center w-full truncate">
                    {isCopyDone ? "Copied!" : label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
};

export default SharePopup;
