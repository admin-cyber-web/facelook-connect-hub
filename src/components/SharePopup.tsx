import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Share2, Check, X, ImageIcon } from "lucide-react";
import { shareToSocial, type SocialPlatform, formatShareUrl } from "@/lib/shareUtils";

export interface SharePostData {
  id: string;
  title?: string;
  content?: string;
  mediaUrl?: string;
  media_url?: string;
  imageUrl?: string;
  image_url?: string;
  videoUrl?: string;
  video_url?: string;
  coverUrl?: string;
  cover_url?: string;
  meta_image?: string;
  mediaType?: string;
  media_type?: string;
  type?: string;
  author?: string;
  meta_title?: string;
  meta_description?: string;
  share_url?: string;
}

export interface ShareAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ShareMode = SocialPlatform;

interface SharePopupProps {
  post: SharePostData;
  anchor?: ShareAnchor;
  onClose: () => void;
  onShare?: (mode: ShareMode, post: SharePostData) => void;
  canvas?: HTMLCanvasElement | null;
}

const PLATFORMS: {
  id: SocialPlatform;
  label: string;
  bg: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    bg: "#25D366",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.306A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.95 7.95 0 01-4.076-1.117l-.292-.174-3.017.791.806-2.94-.19-.302A7.95 7.95 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z" />
      </svg>
    ),
  },
  {
    id: "instagram",
    label: "Instagram",
    bg: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    id: "messenger",
    label: "Messenger",
    bg: "linear-gradient(135deg, #0084ff, #a334fa)",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
        <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.922 1.32 5.532 3.407 7.326V22l3.115-1.708c.831.23 1.712.354 2.624.354 5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.012 12.44l-2.544-2.714-4.967 2.714 5.469-5.8 2.608 2.714 4.903-2.714-5.469 5.8z" />
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    bg: "#1877F2",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.532-4.669 1.313 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    bg: "#000000",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.631 5.903-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: "telegram",
    label: "Telegram",
    bg: "#229ED9",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    id: "copy",
    label: "Copy Link",
    bg: "rgba(255,255,255,0.12)",
    icon: <Link2 size={20} className="text-white" />,
  },
];

const SharePopup: React.FC<SharePopupProps> = ({ post, onClose, onShare }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const targetUrl = formatShareUrl(
    post.share_url || `/post/${encodeURIComponent(post.id)}`,
  );
  const captionText =
    post.content?.trim() ||
    post.title ||
    post.meta_title ||
    "Check this out on Flicks India!";

  const imagePreview =
    post.mediaUrl ||
    post.media_url ||
    post.imageUrl ||
    post.image_url ||
    post.coverUrl ||
    post.cover_url ||
    post.meta_image;

  const mediaType =
    post.mediaType ||
    post.media_type ||
    (/video|reel/i.test(`${post.type || ""}`) ? "video" : "image");

  const handleShare = async (platform: SocialPlatform) => {
    const success = await shareToSocial(platform, {
      title: post.title || post.meta_title || "Flicks India",
      text: captionText,
      url: targetUrl,
      mediaUrl: imagePreview,
      mediaType,
      authorName: post.author,
    });

    if (platform === "copy" && success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }

    if (onShare) {
      onShare(platform, post);
    }

    if (platform !== "copy") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md pointer-events-auto cursor-pointer"
          onClick={onClose}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-[#0F172A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl z-[10001] overflow-hidden pointer-events-auto select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 text-pink-400">
                  <ImageIcon size={22} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">
                  {post.author ? `Shared by ${post.author}` : "Share Post"}
                </p>
                <p className="text-white/50 text-xs truncate max-w-[220px]">
                  {captionText}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer pointer-events-auto relative z-10"
            >
              <X size={18} />
            </button>
          </div>

          {/* Platform Share Options Grid */}
          <div className="grid grid-cols-4 gap-3 py-5 relative z-10">
            {PLATFORMS.map(({ id, label, bg, icon }) => (
              <button
                key={id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleShare(id);
                }}
                className="flex flex-col items-center gap-2 p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-center group cursor-pointer pointer-events-auto relative z-10 select-none"
                style={{ cursor: "pointer" }}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform pointer-events-none"
                  style={{ background: id === "copy" && copied ? "#22c55e" : bg }}
                >
                  {id === "copy" && copied ? (
                    <Check size={20} className="text-white" />
                  ) : (
                    icon
                  )}
                </div>
                <span className="text-[11px] font-semibold text-white/80 group-hover:text-white truncate max-w-full pointer-events-none">
                  {id === "copy" && copied ? "Copied!" : label}
                </span>
              </button>
            ))}
          </div>

          {/* Native Share Button */}
          <div className="pt-2 border-t border-white/10 relative z-10">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleShare("native");
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-transform shadow-lg cursor-pointer pointer-events-auto relative z-10"
              style={{ cursor: "pointer" }}
            >
              <Share2 size={18} />
              <span>Share via OS Share Sheet</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SharePopup;
