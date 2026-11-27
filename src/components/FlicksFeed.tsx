import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { getPostCaption } from "../lib/postCaption";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useDataCache } from "../context/DataCacheContext";
import { useOnlineUsers } from "../context/OnlineUsersContext";
import { isAdminEmail } from "../lib/adminConfig";
import { fetchProfileAdminFlag } from "../lib/adminProfile";
import { useSoundEffects } from "../hooks/useSoundEffects";
import {
  Heart, MessageCircle, Share2, X, Send, ChevronLeft, ChevronRight, Search, RefreshCw,
  BadgeCheck, Loader2, Flag, Trash2, Ban, Pencil, MoreVertical, Reply, EyeOff,
} from "lucide-react";
import { MagnetButton } from "./MagnetSystem";
import { toast } from "sonner";
import SharePopup, {
  type ShareAnchor,
  type ShareMode,
  type SharePostData,
} from "./SharePopup";
import { getReelSettings } from "@/lib/reelSettings";
import { getPostVibeAudioUrl, resolvePostVibe } from "@/lib/vibeMatcher";
import { setVisibleVibeAudio } from "@/lib/vibeAudio";
import {
  attachReelAudioSync,
  getReelAudioTargetTime,
} from "@/lib/reelAudioSync";
import { prefetchReelMedia } from "@/lib/reelPrefetch";
import VibeAudioToggle from "./VibeAudioToggle";
import ActiveStatusAvatar from "./ActiveStatusAvatar";
import SavePostButton from "./SavePostButton";
import { sharePost } from "../lib/sharePost";
import {
  getBunnyVideoId,
  useBunnyVideoStatus,
} from "../hooks/useBunnyVideoStatus";
import BunnyVideoStatusOverlay from "./BunnyVideoStatusOverlay";
import { isHlsUrl, useHlsVideo } from "../hooks/useHlsVideo";
import BunnyCreatorProcessingOverlay from "./BunnyCreatorProcessingOverlay";
import {
  fetchBunnyVideoReadiness,
  getPostBunnyVideoId,
  isBunnyVideoVisibleToViewer,
} from "../lib/bunnyVideoReadiness";

// ── Utilities ─────────────────────────────────────────────────────────────────
const formatCount = (n: number | string | null | undefined): string => {
  const num = Number(n);
  if (!num || isNaN(num)) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (num >= 1_000)     return (num / 1_000).toFixed(num >= 10_000 ? 0 : 1).replace(".0", "") + "K";
  return String(num);
};

const SUPPORTED_VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i;
type FlickPostMetadata = {
  mime_type?: unknown;
  mimeType?: unknown;
  content_type?: unknown;
  [key: string]: unknown;
};
type FlickPostRow = {
  id: string;
  _raw_id?: string;
  author_id?: string | null;
  user_id?: string | null;
  author?: string | null;
  author_avatar?: string | null;
  full_name?: string | null;
  media_url?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  video_url?: string | null;
  type?: string | null;
  metadata?: FlickPostMetadata | null;
  cover_url?: string | null;
  thumb_url?: string | null;
  views_count?: number | null;
  likes_count?: number | null;
  comments_count?: number | null;
  shares_count?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  audio_url?: string | null;
  created_at?: string | null;
  visibility?: string | null;
  author_profile?: { is_private_mode?: boolean | null; full_name?: string | null; avatar_url?: string | null } | null;
  is_admin_post?: boolean | null;
  bunny_ready?: boolean | null;
  liked_by_me?: boolean | null;
  content?: string | null;
  caption?: string | null;
  description?: string | null;
  _source?: string | null;
  thumbnail_url?: string | null;
  poster_url?: string | null;
  preview_url?: string | null;
  video_thumbnail_url?: string | null;
  media_type?: string | null;
};
const FLICKS_POST_PROJECTION =
  "id, author, author_id, content, media_url, image_url, image_urls, type, metadata, cover_url, views_count, likes_count, comments_count, shares_count, meta_title, meta_description, created_at, visibility, is_admin_post, video_url, media_type, audio_url, author_profile:profiles!posts_author_id_fkey(avatar_url, full_name, is_private_mode)";
const FLICKS_POST_PROJECTION_WITH_AUDIO = FLICKS_POST_PROJECTION;
const FLICKS_CACHE_KEY = "flicks-feed:v1";
const FLICKS_CACHE_LIMIT = 30;

type PersistedFlick = Record<string, unknown> & {
  id: string;
  visibility: "public";
  author_profile?: { is_private_mode?: boolean | null } | null;
  bunny_ready?: boolean;
  liked_by_me?: boolean;
};

function isPublicPersistedFlick(value: unknown): value is PersistedFlick {
  if (!value || typeof value !== "object") return false;
  const post = value as Record<string, unknown>;
  const profile = post.author_profile;
  const isPrivate =
    Boolean(profile) &&
    typeof profile === "object" &&
    "is_private_mode" in profile &&
    profile.is_private_mode === true;
  return (
    typeof post.id === "string" &&
    post.visibility === "public" &&
    !isPrivate &&
    post.bunny_ready !== false
  );
}

function readPersistedFlicks(): PersistedFlick[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(FLICKS_CACHE_KEY) || "null",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isPublicPersistedFlick)
      .slice(0, FLICKS_CACHE_LIMIT)
      .map((post) => ({ ...post, liked_by_me: false }));
  } catch (error) {
    console.warn("[Flicks] Could not read persisted feed cache:", error);
    return [];
  }
}

function persistFlicks(posts: unknown[]) {
  if (typeof window === "undefined") return;
  const publicPosts = posts
    .filter(isPublicPersistedFlick)
    .slice(0, FLICKS_CACHE_LIMIT)
    .map((post) => ({ ...post, liked_by_me: false }));
  try {
    window.localStorage.setItem(FLICKS_CACHE_KEY, JSON.stringify(publicPosts));
  } catch (error) {
    console.warn("[Flicks] Could not persist feed cache:", error);
  }
}

const requestPlayback = (media: HTMLMediaElement, muted = false) => {
  media.muted = muted;
  media.volume = 1;
  try {
    void media.play().catch(() => {
      // A rejected autoplay is retried from the active card's gesture listeners.
    });
  } catch {
    // Wait for the next user gesture if play() throws synchronously.
  }
};

const isMissingAudioUrlColumn = (error: unknown) => {
  if (typeof error !== "object" || error === null) return false;
  const details = error as {
    code?: unknown;
    details?: unknown;
    message?: unknown;
  };
  return (
    (details.code === "PGRST204" || details.code === "42703") &&
    /audio_url/i.test(`${details.message || ""} ${details.details || ""}`)
  );
};

const isSupportedVideoUrl = (
  url: unknown,
  metadata?: FlickPostMetadata | null,
): boolean => {
  if (typeof url !== "string" || !url.trim()) return false;
  if (isHlsUrl(url)) return true;
  const declaredMime = String(
    metadata?.mime_type || metadata?.mimeType || metadata?.content_type || "",
  ).toLowerCase();
  if (declaredMime.startsWith("video/")) return true;
  return SUPPORTED_VIDEO_EXTENSIONS.test(url) || /rapidcdn/i.test(url);
};

// ── CSS injection (keyframes for marquee + reel spin, done once) ──────────────
function injectFlicksStyles() {
  const id = "flicks-global-styles";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    @keyframes flick-ticker {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @keyframes flick-reel {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(s);
}

// ── Spinning Cassette SVG (vibrant deep-orange palette) ──────────────────────
const Reel = ({ cx, cy, spinning }: { cx: number; cy: number; spinning: boolean }) => (
  <>
    <circle cx={cx} cy={cy} r={4.2} fill="#1a0c02" stroke="rgba(255,120,20,0.55)" strokeWidth="0.9" />
    <circle cx={cx} cy={cy} r={1.6} fill="rgba(255,141,0,0.9)" />
    <g style={{
      transformOrigin: `${cx}px ${cy}px`,
      animation: spinning ? "flick-reel 0.85s linear infinite" : "none",
    }}>
      <line x1={cx}       y1={cy - 4.2} x2={cx}       y2={cy - 1.9} stroke="rgba(255,141,0,0.7)" strokeWidth="0.85" />
      <line x1={cx + 3.6} y1={cy - 2.1} x2={cx + 1.6} y2={cy - 0.9} stroke="rgba(255,141,0,0.7)" strokeWidth="0.85" />
      <line x1={cx + 3.6} y1={cy + 2.1} x2={cx + 1.6} y2={cy + 0.9} stroke="rgba(255,141,0,0.7)" strokeWidth="0.85" />
    </g>
  </>
);

const AudioCassette = ({ spinning, compact = false }: { spinning: boolean; compact?: boolean }) => (
  <svg
    width={compact ? 28 : 40}
    height={compact ? 20 : 28}
    viewBox="0 0 40 28"
    fill="none"
    className="shrink-0"
    style={{ filter: "drop-shadow(0 0 4px rgba(255,109,0,0.45))" }}
  >
    {/* Body */}
    <rect x="0.5" y="0.5" width="39" height="27" rx="3.5" fill="#190d02" stroke="rgba(255,109,0,0.6)" strokeWidth="1" />
    {/* Tape window */}
    <rect x="7.5" y="7" width="25" height="14" rx="2" fill="#0d0602" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
    {/* Reels */}
    <Reel cx={13} cy={14} spinning={spinning} />
    <Reel cx={27} cy={14} spinning={spinning} />
    {/* Center hub bar */}
    <rect x="15.5" y="13.2" width="9" height="1.6" rx="0.8" fill="rgba(255,109,0,0.3)" />
    {/* Screw holes */}
    <circle cx={4}  cy={4}  r={1.4} fill="#2a1405" />
    <circle cx={36} cy={4}  r={1.4} fill="#2a1405" />
    <circle cx={4}  cy={24} r={1.4} fill="#2a1405" />
    <circle cx={36} cy={24} r={1.4} fill="#2a1405" />
    {/* Label strip */}
    <rect x="9" y="21.5" width="22" height="3" rx="1.2" fill="rgba(255,141,0,0.2)" />
  </svg>
);

// ── Scrolling Ticker ──────────────────────────────────────────────────────────
const Ticker = ({ text, isActive }: { text: string; isActive: boolean }) => {
  const duration = Math.max(8, Math.min(22, text.length * 0.18));
  return (
    <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          animation: isActive ? `flick-ticker ${duration}s linear infinite` : "none",
          willChange: "transform",
        }}
      >
        <span className="text-[10px] font-bold tracking-wide" style={{ color: "rgba(255,180,195,0.85)" }}>{text}</span>
        <span className="text-[10px] font-bold tracking-wide" style={{ color: "rgba(255,180,195,0.85)", marginLeft: "5rem" }}>{text}</span>
      </div>
    </div>
  );
};

// ── Comment Box (fast swipe menu + emoji likes + replies + hide/delete) ───────
type CommentItem = {
  id: string;
  post_id?: string;
  content: string;
  user_id?: string;
  author?: string;
  created_at?: string;
  parent_id?: string | null;
  reply_to_author?: string | null;
  profiles?:
    | { username?: string; full_name?: string; avatar_url?: string }
    | { username?: string; full_name?: string; avatar_url?: string }[]
    | null;
};

type CommentReactionState = {
  emoji: string | null;
  count: number;
};

type CommentBoxProps = {
  post: FlickPostRow;
  currentUserId: string | null;
  onClose: () => void;
  onCommentAdded?: (newCount?: number) => void;
  onCommentDeleted?: () => void;
};

const COMMENT_EMOJIS = ["❤️", "😂", "🔥", "😮", "😢", "🙏"] as const;

const formatCommentTime = (dateStr?: string): string => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff) || diff < 0) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

function readHiddenCommentIds(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeHiddenCommentIds(storageKey: string, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    // ignore storage errors
  }
}

const CommentBox = ({ post, currentUserId, onClose, onCommentAdded, onCommentDeleted }: CommentBoxProps) => {
  const onlineUserIds = useOnlineUsers();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ id: string; author: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [emojiPickerForId, setEmojiPickerForId] = useState<string | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const [reactionsByComment, setReactionsByComment] = useState<Record<string, CommentReactionState>>({});
  const swipeStartRef = useRef<{ id: string; x: number; y: number; locked: "h" | "v" | null }>({
    id: "",
    x: 0,
    y: 0,
    locked: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const sounds = useSoundEffects();

  const targetPostId = post._raw_id || (post.id ? String(post.id).replace(/^post_/, "") : "");
  const postOwnerId = post.author_id || post.user_id || null;
  const isPostOwner = Boolean(currentUserId && postOwnerId && currentUserId === postOwnerId);

  const userHiddenStorageKey = useMemo(
    () => `flicks:hidden-comments:${currentUserId || "guest"}:${targetPostId}`,
    [currentUserId, targetPostId],
  );
  const postOwnerHiddenStorageKey = useMemo(
    () => `flicks:post-owner-hidden-comments:${targetPostId}`,
    [targetPostId],
  );

  const [hiddenCommentIds, setHiddenCommentIds] = useState<string[]>(() => [
    ...readHiddenCommentIds(`flicks:hidden-comments:${currentUserId || "guest"}:${targetPostId}`),
    ...readHiddenCommentIds(`flicks:post-owner-hidden-comments:${targetPostId}`),
  ]);

  useEffect(() => {
    setHiddenCommentIds([
      ...readHiddenCommentIds(userHiddenStorageKey),
      ...readHiddenCommentIds(postOwnerHiddenStorageKey),
    ]);
  }, [userHiddenStorageKey, postOwnerHiddenStorageKey]);

  const hideCommentLocally = useCallback(
    (commentId: string, scopeLabel: string) => {
      const nextUserHidden = [...readHiddenCommentIds(userHiddenStorageKey), commentId];
      writeHiddenCommentIds(userHiddenStorageKey, nextUserHidden);
      if (isPostOwner) {
        const nextOwnerHidden = [...readHiddenCommentIds(postOwnerHiddenStorageKey), commentId];
        writeHiddenCommentIds(postOwnerHiddenStorageKey, nextOwnerHidden);
      }
      setHiddenCommentIds(prev => Array.from(new Set([...prev, commentId])));
      setActiveMenuId(null);
      setEmojiPickerForId(null);
      setSwipeOffsets(prev => ({ ...prev, [commentId]: 0 }));
      toast.success(scopeLabel);
    },
    [isPostOwner, postOwnerHiddenStorageKey, userHiddenStorageKey],
  );

  useEffect(() => {
    if (!targetPostId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("comments")
      .select("id, post_id, content, user_id, author, created_at, profiles:user_id(username, full_name, avatar_url)")
      .eq("post_id", targetPostId)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          console.warn("[Flicks] comment fetch failed:", error.message);
          toast.error("Failed to load comments");
          return;
        }
        const rows = (data || []) as CommentItem[];
        setComments(rows);
        setReactionsByComment(prev => {
          const next = { ...prev };
          rows.forEach((row) => {
            if (!next[row.id]) {
              next[row.id] = { emoji: null, count: 0 };
            }
          });
          return next;
        });
      });
    return () => { cancelled = true; };
  }, [targetPostId]);

  const visibleComments = useMemo(
    () => comments.filter(c => !hiddenCommentIds.includes(c.id)),
    [comments, hiddenCommentIds],
  );

  const handleToggleEmojiReaction = (commentId: string, emoji: string) => {
    sounds?.playPop?.();
    setReactionsByComment(prev => {
      const current = prev[commentId] || { emoji: null, count: 0 };
      if (current.emoji === emoji) {
        return {
          ...prev,
          [commentId]: { emoji: null, count: Math.max(0, current.count - 1) },
        };
      }
      const nextCount = current.emoji ? current.count : current.count + 1;
      return {
        ...prev,
        [commentId]: { emoji, count: nextCount },
      };
    });
    setEmojiPickerForId(null);
    setActiveMenuId(null);
  };

  const handleQuickLikeComment = (commentId: string) => {
    handleToggleEmojiReaction(commentId, "❤️");
  };

  const handleStartReply = (comment: CommentItem) => {
    const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
    const authorName = profile?.full_name || profile?.username || comment.author || "User";
    setReplyTarget({ id: comment.id, author: authorName });
    setActiveMenuId(null);
    setEmojiPickerForId(null);
    setSwipeOffsets(prev => ({ ...prev, [comment.id]: 0 }));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handlePostComment = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Please write a comment first");
      return;
    }
    if (!currentUserId) {
      toast.error("Please login to comment");
      return;
    }
    setSending(true);
    sounds?.playSwoosh?.();
    const formattedContent = replyTarget
      ? `@${replyTarget.author} ${trimmed}`
      : trimmed;
    const activeReply = replyTarget;
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert([{
          post_id: targetPostId,
          content: formattedContent,
          user_id: currentUserId,
          author: "User",
        }])
        .select("id, post_id, content, user_id, author, created_at, profiles:user_id(username, full_name, avatar_url)")
        .single();

      if (error) throw error;
      if (data) {
        const enriched: CommentItem = {
          ...(data as CommentItem),
          parent_id: activeReply?.id ?? null,
          reply_to_author: activeReply?.author ?? null,
        };
        setComments(prev => [...prev, enriched]);
        setText("");
        setReplyTarget(null);
        toast.success(activeReply ? "Reply posted!" : "Comment posted!");
        onCommentAdded?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || "Failed to post comment";
      console.error("[Flicks] post comment error:", err);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };
  const handleStartEdit = (comment: CommentItem) => {
    setEditingId(comment.id);
    setEditText(comment.content);
    setActiveMenuId(null);
    setEmojiPickerForId(null);
    setSwipeOffsets(prev => ({ ...prev, [comment.id]: 0 }));
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editText.trim();
    if (!trimmed) {
      toast.error("Comment cannot be empty");
      return;
    }
    setActionId(id);
    try {
      const { data, error } = await supabase
        .from("comments")
        .update({ content: trimmed })
        .eq("id", id)
        .eq("user_id", currentUserId)
        .select("id, post_id, content, user_id, author, created_at, profiles:user_id(username, full_name, avatar_url)")
        .single();

      if (error) throw error;
      if (data) {
        setComments(prev => prev.map(c => c.id === id ? { ...c, ...(data as CommentItem) } : c));
        setEditingId(null);
        setEditText("");
        toast.success("Comment updated!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || "Failed to update comment";
      console.error("[Flicks] edit comment error:", err);
      toast.error(msg);
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteForMe = (comment: CommentItem) => {
    hideCommentLocally(comment.id, "Comment deleted for you");
  };

  const handleHideComment = (comment: CommentItem) => {
    hideCommentLocally(
      comment.id,
      isPostOwner ? "Comment hidden by reel owner" : "Comment hidden on your device",
    );
  };

  const handleDeleteForEveryone = async (id: string) => {
    if (!currentUserId) return;
    setActiveMenuId(null);
    setEmojiPickerForId(null);
    setActionId(id);
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUserId);

      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== id));
      toast.success("Comment deleted for everyone");
      onCommentDeleted?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || "Failed to delete comment";
      console.error("[Flicks] delete comment error:", err);
      toast.error(msg);
    } finally {
      setActionId(null);
    }
  };

  const handleCommentTouchStart = (commentId: string, e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length !== 1) return;
    swipeStartRef.current = {
      id: commentId,
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      locked: null,
    };
  };

  const handleCommentTouchMove = (commentId: string, e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length !== 1 || swipeStartRef.current.id !== commentId) return;
    const dx = e.touches[0].clientX - swipeStartRef.current.x;
    const dy = e.touches[0].clientY - swipeStartRef.current.y;

    if (!swipeStartRef.current.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      swipeStartRef.current.locked = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }

    if (swipeStartRef.current.locked === "h") {
      const clamped = Math.max(-96, Math.min(96, dx));
      setSwipeOffsets(prev => ({ ...prev, [commentId]: clamped }));
      if (Math.abs(clamped) >= 36) {
        setActiveMenuId(commentId);
      }
    }
  };

  const handleCommentTouchEnd = (commentId: string, e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (swipeStartRef.current.id !== commentId) return;
    const currentOffset = swipeOffsets[commentId] ?? 0;
    if (Math.abs(currentOffset) >= 36) {
      setActiveMenuId(commentId);
      setSwipeOffsets(prev => ({ ...prev, [commentId]: currentOffset < 0 ? -56 : 56 }));
    } else {
      setSwipeOffsets(prev => ({ ...prev, [commentId]: 0 }));
    }
    swipeStartRef.current = { id: "", x: 0, y: 0, locked: null };
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      data-no-media-playback-retry="true"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl z-[10000] h-[70vh] flex flex-col border-t border-white/10 shadow-2xl"
      style={{ touchAction: "pan-y" }}
      onClick={e => {
        e.stopPropagation();
        if (emojiPickerForId) setEmojiPickerForId(null);
      }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      {/* Drawer Handle & Header */}
      <div className="pt-3 pb-2 px-4 border-b border-white/10 flex flex-col items-center relative">
        <div className="w-12 h-1 bg-white/20 rounded-full mb-3" />
        <div className="w-full flex justify-between items-center">
          <span className="text-white font-bold text-base tracking-wide flex items-center gap-2">
            Comments
            <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full text-white/70">
              {visibleComments.length}
            </span>
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
            aria-label="Close comments"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Comment List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/40 gap-2">
            <Loader2 size={20} className="animate-spin text-cyan-400" />
            <span className="text-sm">Loading comments…</span>
          </div>
        ) : visibleComments.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <p className="text-white/40 text-sm font-medium">No comments yet</p>
            <p className="text-white/25 text-xs">Be the first to share your thoughts!</p>
          </div>
        ) : (
          visibleComments.map((c) => {
            const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            const commentUsername = profile?.full_name || profile?.username || c.author || "User";
            const isCommentOwner = Boolean(currentUserId && c.user_id === currentUserId);
            const isEditing = editingId === c.id;
            const isBusy = actionId === c.id;
            const isMenuOpen = activeMenuId === c.id;
            const isEmojiOpen = emojiPickerForId === c.id;
            const reactionState = reactionsByComment[c.id] || { emoji: null, count: 0 };
            const offset = swipeOffsets[c.id] ?? 0;
            const timeAgo = formatCommentTime(c.created_at);

            return (
              <div
                key={c.id}
                className="relative overflow-hidden rounded-2xl"
                onTouchStart={(e) => handleCommentTouchStart(c.id, e)}
                onTouchMove={(e) => handleCommentTouchMove(c.id, e)}
                onTouchEnd={(e) => handleCommentTouchEnd(c.id, e)}
              >
                {/* Fast swipe / arrow action bar */}
                {isMenuOpen && (
                  <div
                    className="mb-1.5 flex items-center gap-1.5 overflow-x-auto rounded-xl bg-zinc-950/95 px-2 py-1.5 border border-white/10"
                    style={{ transition: "transform 120ms ease-out" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="shrink-0 text-[10px] font-bold text-cyan-300 px-1.5 py-0.5 rounded bg-cyan-500/10">
                      Swipe Menu
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleStartReply(c); }}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold"
                    >
                      <Reply size={12} className="text-cyan-400" />
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleHideComment(c); }}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-semibold"
                    >
                      <EyeOff size={12} />
                      Hide{isPostOwner ? " (Owner)" : ""}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteForMe(c); }}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/85 text-[11px] font-semibold"
                    >
                      <Trash2 size={12} className="text-rose-300" />
                      Delete for me
                    </button>
                    {isCommentOwner && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(c); }}
                          disabled={isBusy}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-[11px] font-semibold"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleDeleteForEveryone(c.id); }}
                          disabled={isBusy}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-semibold"
                        >
                          <Trash2 size={12} />
                          Delete for everyone
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(null);
                        setSwipeOffsets(prev => ({ ...prev, [c.id]: 0 }));
                      }}
                      className="shrink-0 p-1 rounded-lg text-white/50 hover:text-white"
                      aria-label="Close comment actions"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                <div
                  className="flex gap-2.5 items-start group"
                  style={{
                    transform: `translateX(${offset}px)`,
                    transition: swipeStartRef.current.id === c.id ? "none" : "transform 130ms ease-out",
                  }}
                >
                  <ActiveStatusAvatar
                    src={profile?.avatar_url}
                    name={commentUsername}
                    size={32}
                    online={onlineUserIds.has(c.user_id || "")}
                  />
                  <div className="flex-1 min-w-0 bg-white/[0.03] rounded-2xl p-3 border border-white/5 relative">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white/90 text-xs font-semibold truncate">
                          {commentUsername}
                        </span>
                        {timeAgo && (
                          <span className="text-white/30 text-[10px] shrink-0">
                            {timeAgo}
                          </span>
                        )}
                      </div>

                      {/* Right wall arrow indicator: tap to reveal animated swipe menu */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextOpen = !isMenuOpen;
                          setActiveMenuId(nextOpen ? c.id : null);
                          setSwipeOffsets(prev => ({ ...prev, [c.id]: nextOpen ? -24 : 0 }));
                        }}
                        aria-label="Open comment swipe menu"
                        className="shrink-0 -mr-1.5 flex items-center gap-0.5 rounded-l-full bg-white/[0.06] hover:bg-white/[0.12] px-1.5 py-0.5 text-white/55 hover:text-white transition-colors"
                      >
                        {isMenuOpen && (
                          <span className="text-[9px] font-bold tracking-tight text-cyan-300">
                            Swipe
                          </span>
                        )}
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onPointerDown={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          onTouchStart={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none border border-cyan-500/50 focus:border-cyan-400 resize-none min-h-[60px]"
                          style={{ fontSize: 16 }}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditText(""); }}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleSaveEdit(c.id); }}
                            disabled={isBusy || !editText.trim()}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1"
                          >
                            {isBusy && <Loader2 size={12} className="animate-spin" />}
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-white/85 text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {c.content}
                      </p>
                    )}

                    {/* Like / Emoji reaction + Reply row */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="relative flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleQuickLikeComment(c.id); }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEmojiPickerForId(prev => prev === c.id ? null : c.id);
                          }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-white/65 hover:text-rose-400 transition-colors"
                          aria-label="Like comment"
                        >
                          <Heart
                            size={12}
                            fill={reactionState.emoji === "❤️" ? "#FF2D55" : "none"}
                            className={reactionState.emoji === "❤️" ? "text-[#FF2D55]" : "text-white/60"}
                          />
                          <span>Like</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmojiPickerForId(prev => prev === c.id ? null : c.id);
                          }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-white/65 hover:text-amber-300 transition-colors"
                          aria-label="React with emoji"
                        >
                          <span>{reactionState.emoji || "😊"}</span>
                          <span>React</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleStartReply(c); }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-white/65 hover:text-cyan-300 transition-colors"
                        >
                          <Reply size={12} />
                          <span>Reply</span>
                        </button>

                        {/* All emoji picker bar */}
                        {isEmojiOpen && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className="absolute left-0 bottom-6 z-20 flex items-center gap-1 rounded-full bg-zinc-950/95 border border-white/15 px-2 py-1 shadow-xl"
                          >
                            {COMMENT_EMOJIS.map((em) => (
                              <button
                                key={em}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleToggleEmojiReaction(c.id, em); }}
                                className={`px-1.5 py-0.5 rounded-full text-sm transition-transform active:scale-110 ${
                                  reactionState.emoji === em ? "bg-white/20 scale-110" : "hover:bg-white/10"
                                }`}
                                aria-label={`React ${em}`}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {reactionState.count > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-white/80">
                          <span>{reactionState.emoji || "❤️"}</span>
                          <span>{reactionState.count}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply target indicator */}
      {replyTarget && (
        <div className="px-3.5 py-1.5 bg-zinc-900/95 border-t border-white/10 flex items-center justify-between text-xs text-cyan-300">
          <span className="truncate">
            Replying to <strong className="font-bold">@{replyTarget.author}</strong>
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setReplyTarget(null); }}
            className="text-white/60 hover:text-white p-0.5"
            aria-label="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input Section */}
      <div className="p-3 bg-zinc-950/80 border-t border-white/10 flex gap-2 items-center pb-safe">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className="flex-1 bg-white/10 hover:bg-white/[0.13] focus:bg-white/[0.15] rounded-full px-4 py-2.5 text-white text-sm outline-none border border-white/10 focus:border-cyan-500/50 placeholder:text-white/40 transition-colors"
          style={{ fontSize: 16 }}
          placeholder={replyTarget ? `Reply to @${replyTarget.author}...` : "Write a comment..."}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handlePostComment();
            }
          }}
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void handlePostComment(); }}
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          disabled={sending || !text.trim()}
          className="bg-cyan-500 hover:bg-cyan-400 w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 disabled:hover:bg-cyan-500 transition-all shadow-md active:scale-95"
          aria-label="Send comment"
        >
          {sending ? (
            <Loader2 className="animate-spin text-white" size={16} />
          ) : (
            <Send size={16} className="text-white ml-0.5" />
          )}
        </button>
      </div>
    </motion.div>
  );
};

// ── FlickCard ─────────────────────────────────────────────────────────────────
type FlickCardProps = {
  post: FlickPostRow;
  isActive: boolean;
  isPreloaded: boolean;
  isNext: boolean;
  isWarmNext: boolean;
  currentUserId: string | null;
  onBridgeChat?: (userId: string) => void;
  onEditReel?: (post: FlickPostRow) => void;
  isAdmin: boolean;
  onPostDeleted?: (postId: string) => void;
  onPostDeleteOptimistic?: (postId: string, post: FlickPostRow) => void;
  onPostDeleteRollback?: (postId: string) => void;
  onUserBanned?: (authorId: string) => void;
  onVideoInvalid?: (postId: string) => void;
};

const FlickCard = memo(({ post, isActive, isPreloaded, isNext, isWarmNext, currentUserId, onBridgeChat, onEditReel, isAdmin, onPostDeleted, onPostDeleteOptimistic, onPostDeleteRollback, onUserBanned, onVideoInvalid }: FlickCardProps) => {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const audioRef   = useRef<HTMLAudioElement>(null);
  const tapTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap    = useRef<number>(0);
  const likeBusyRef = useRef(false);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [likedByMe,         setLikedByMe]         = useState(false);
  const [liveLikes,         setLiveLikes]          = useState(Number(post?.likes_count || 0));
  const [liveCommentsCount, setLiveCommentsCount]  = useState(Number(post?.comments_count || 0));
  const [liveShares,        setLiveShares]        = useState(Number(post?.shares_count || 0));
  const [heartPos,          setHeartPos]           = useState<{ x: number; y: number } | null>(null);
  const [showComments,      setShowComments]       = useState(false);
  const [menuOpen,          setMenuOpen]           = useState(false);
  const [reportOpen,        setReportOpen]         = useState(false);
  const [reportAnchor,      setReportAnchor]       = useState<{ top: number; right: number } | null>(null);
  const [reportText,        setReportText]         = useState("");
  const [reporting,         setReporting]          = useState(false);
  const [deleting,          setDeleting]           = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editingCaption,    setEditingCaption]     = useState(false);
  const [savingCaption,     setSavingCaption]      = useState(false);
  const [localContent,      setLocalContent]       = useState(() => getPostCaption(post));
  // ── Video health states ────────────────────────────────────────────────
  const [videoError,        setVideoError]         = useState<string | null>(null);
  const [hasPlayableVideo, setHasPlayableVideo] = useState(false);
  const [sharePopupData, setSharePopupData] = useState<{
    post: SharePostData;
    anchor: ShareAnchor;
  } | null>(null);
  const sounds = useSoundEffects();
  const { openProfile } = useProfileViewer();
  const onlineUserIds = useOnlineUsers();
  const reelSettings = useMemo(() => getReelSettings(post), [post]);
  const videoUrl = reelSettings.videoUrl || post.media_url || post.video_url || post.image_url || "";
  const bunnyVideoId = getBunnyVideoId(videoUrl, post?.metadata?.bunny_video_id);
  const isCreator = Boolean(currentUserId && post.author_id === currentUserId);
  const bunnyVideoStatus = useBunnyVideoStatus(bunnyVideoId, isActive && isCreator);
  const bunnyVideoReady =
    post?.bunny_ready === true ||
    bunnyVideoStatus.phase === "ready" ||
    hasPlayableVideo;
  const hlsPlayback = useHlsVideo(
    videoRef,
    videoUrl,
    isPreloaded && (!isCreator || bunnyVideoReady),
    post?.bunny_ready === true || bunnyVideoStatus.phase === "ready" ? "ready" : "pending",
    isActive,
    isPreloaded && !isActive,
  );
  const visibleVideoError = isCreator && !bunnyVideoReady && bunnyVideoId
    ? null
    : videoError || hlsPlayback.error;
  const hasBackgroundAudio = Boolean(reelSettings.audioUrl);
  useEffect(() => {
    setHasPlayableVideo(false);
  }, [videoUrl]);
  const vibe = useMemo(() => resolvePostVibe(post), [post]);
  const secondaryVibe = vibe.matches.find(
    (profile) => profile.tag !== vibe.primary?.tag,
  );
  const vibeAudioUrl = hasBackgroundAudio ? null : getPostVibeAudioUrl(post, vibe);
  const vibePostId = String(post?._raw_id ?? post?.id ?? "");

  useEffect(() => {
    setLikedByMe(Boolean(post?.liked_by_me));
    setLiveLikes(Number(post?.likes_count || 0));
    setLiveCommentsCount(Number(post?.comments_count || 0));
    setLiveShares(Number(post?.shares_count || 0));
    setLocalContent(getPostCaption(post));
  }, [
    post?.id,
    post?.liked_by_me,
    post?.likes_count,
    post?.comments_count,
    post?.shares_count,
    post?.content,
    post?.caption,
    post?.description,
    post?.metadata,
  ]);

  useEffect(() => () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("flicks:comment-drawer-state", {
        detail: { open: Boolean(isActive && showComments) },
      }),
    );
  }, [isActive, showComments]);

  useEffect(() => {
    if (!isActive) setShowComments(false);
  }, [isActive]);

  useEffect(() => () => {
    window.dispatchEvent(
      new CustomEvent("flicks:comment-drawer-state", { detail: { open: false } }),
    );
  }, []);

  useEffect(() => {
    if (!isActive || !bunnyVideoReady) return;
    const video = videoRef.current;
    if (!video) return;
    setVideoError(null);
    if (!hlsPlayback.isHls) video.load();
    requestPlayback(video, hasBackgroundAudio);
  }, [bunnyVideoReady, hasBackgroundAudio, hlsPlayback.isHls, isActive, videoUrl]);

  // ── Parse MediaError into a human-readable label ──────────────────────
  const parseMediaError = (err: MediaError | null): string => {
    if (!err) return "Unknown playback error";
    switch (err.code) {
      case MediaError.MEDIA_ERR_ABORTED:       return "Playback aborted";
      case MediaError.MEDIA_ERR_NETWORK:       return "Network error — check your connection";
      case MediaError.MEDIA_ERR_DECODE:        return "Video decode error";
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: return "Video format not supported";
      default:                                  return "Playback error";
    }
  };

  // ── Play / pause + sound when card enters/leaves view ──────────────────
  useEffect(() => {
    const vid = videoRef.current;
    const audio = audioRef.current;
    if (!vid) return;
    vid.playbackRate = reelSettings.playbackRate;
    vid.style.filter = reelSettings.cssFilter;
    // A reel with attached music uses its dedicated audio element, so its
    // camera/source audio must stay muted to prevent overlapping tracks.
    // Reels WITHOUT a custom track keep their own audio — always-on sound.
    vid.muted = hasBackgroundAudio;
    vid.volume = 1;
    if (audio) {
      audio.playbackRate = reelSettings.playbackRate;
      audio.loop = true;
      audio.muted = false;
      audio.volume = 1;
    }
    if (!isActive) {
      vid.pause();
      audio?.pause();
      return;
    }

    // Reset transient error/loading on each activation (e.g. after scrolling away and back).
    setVideoError(null);
    vid.currentTime = 0;

    const playbackRetryBlockers =
      '[data-no-media-playback-retry], [aria-modal="true"], [role="dialog"], dialog[open]';
    const retryActivePlayback = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(playbackRetryBlockers)
      ) {
        return;
      }
      // Scroll events can target document/window rather than the scrolled
      // element. Never restart the reel behind an open dialog.
      if (
        !(target instanceof Element) &&
        document.querySelector(playbackRetryBlockers)
      ) {
        return;
      }
      if (document.visibilityState === "hidden") return;
      const activeVideo = videoRef.current;
      if (!activeVideo || !activeVideo.isConnected) return;
      activeVideo.muted = hasBackgroundAudio;
      activeVideo.volume = hasBackgroundAudio ? 0 : 1;
      const videoWasPaused = activeVideo.paused;
      if (videoWasPaused) requestPlayback(activeVideo, hasBackgroundAudio);

      const activeAudio = audioRef.current;
      if (hasBackgroundAudio && activeAudio && !videoWasPaused) {
        activeAudio.muted = false;
        activeAudio.volume = 1;
        if (activeAudio.paused) {
          if (activeAudio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            activeAudio.currentTime = getReelAudioTargetTime(activeVideo, activeAudio);
          }
          requestPlayback(activeAudio);
        }
      }
    };
    const gestureEvents = ["pointerdown", "touchstart", "click", "scroll", "wheel"] as const;
    gestureEvents.forEach((eventName) =>
      document.addEventListener(eventName, retryActivePlayback, {
        capture: true,
        passive: true,
      }),
    );

    requestPlayback(vid, hasBackgroundAudio);

    return () => {
      gestureEvents.forEach((eventName) =>
        document.removeEventListener(eventName, retryActivePlayback, true),
      );
    };
  }, [
    hasBackgroundAudio,
    isActive,
    reelSettings.audioUrl,
    reelSettings.cssFilter,
    reelSettings.playbackRate,
    videoUrl,
  ]);

  useEffect(() => {
    setVisibleVibeAudio(vibePostId, vibeAudioUrl, isActive);
    return () => setVisibleVibeAudio(vibePostId, vibeAudioUrl, false);
  }, [isActive, vibeAudioUrl, vibePostId]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !hasBackgroundAudio) return;
    return attachReelAudioSync(
      video,
      audio,
      reelSettings.playbackRate,
      () => isActive,
    );
  }, [
    hasBackgroundAudio,
    isActive,
    reelSettings.audioUrl,
    reelSettings.playbackRate,
    videoUrl,
  ]);

  // ── Core like logic (used by button + double-tap) ─────────────────────
  const refreshLikeState = useCallback(async () => {
    const isFlick = post._source === "flicks";
    const likesTable = isFlick ? "flick_likes" : "likes";
    const fkCol = isFlick ? "flick_id" : "post_id";
    const targetId = post._raw_id || post.id;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const authUserId = authData.user?.id || null;

    const [countResult, mineResult] = await Promise.all([
      supabase
        .from(likesTable)
        .select("id", { count: "exact", head: true })
        .eq(fkCol, targetId),
      authUserId
        ? supabase
            .from(likesTable)
            .select("id")
            .eq(fkCol, targetId)
            .eq("user_id", authUserId)
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (countResult.error) throw countResult.error;
    if (mineResult.error) throw mineResult.error;

    setLiveLikes(countResult.count ?? 0);
    setLikedByMe(Boolean(mineResult.data?.length));
  }, [currentUserId, post._raw_id, post._source, post.id]);

  const triggerLike = async () => {
    if (!currentUserId) { toast.error("Please login to like"); return; }
    if (likeBusyRef.current) return;
    likeBusyRef.current = true;
    sounds?.playPop?.();
    const isLiking = !likedByMe;
    const previousLiked = likedByMe;
    const previousCount = liveLikes;
    setLikedByMe(isLiking);
    setLiveLikes(prev => isLiking ? prev + 1 : Math.max(prev - 1, 0));
    const isFlick   = post._source === "flicks";
    const likesTable = isFlick ? "flick_likes" : "likes";
    const fkCol     = isFlick ? "flick_id"   : "post_id";
    const targetId  = post._raw_id || post.id;
    try {
      // Never trust a prop for ownership. Supabase RLS validates this against
      // auth.uid(), so use the session's authenticated user ID in the row.
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const authUserId = authData.user?.id;
      if (!authUserId) throw new Error("No authenticated user");
      if (authUserId !== currentUserId) {
        console.warn("[Flicks] currentUserId prop differed from auth user; using auth user", {
          currentUserId,
          authUserId,
        });
      }

      if (isLiking) {
        const { error } = await supabase
          .from(likesTable)
          .upsert(
            {
              [fkCol]: targetId,
              user_id: authUserId,
              ...(isFlick ? {} : { reaction_type: "like" }),
            },
            {
              onConflict: `${fkCol},user_id`,
              ignoreDuplicates: true,
            },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(likesTable)
          .delete()
          .eq(fkCol, targetId)
          .eq("user_id", authUserId);
        if (error) throw error;
      }
      // Keep the optimistic card state after a successful mutation. The feed
      // already receives the server counter with the bounded post projection;
      // rereading count + viewer row here doubled egress for every tap.
    } catch (err) {
      // A failed mutation may still have reached the database. Reconcile
      // first; only roll back the optimistic state if the authoritative read
      // also fails.
      try {
        await refreshLikeState();
      } catch {
        setLikedByMe(previousLiked);
        setLiveLikes(previousCount);
      }
      console.error("[Flicks] like update failed:", err);
      toast.error("Like update nahi hua");
    } finally {
      likeBusyRef.current = false;
    }
  };

  // ── Tap handler: double-tap anywhere on the video = like ────────────────
  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double-tap detected
      if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
      lastTap.current = 0;
      const rect = e.currentTarget.getBoundingClientRect();
      setHeartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (!likedByMe) void triggerLike();
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
      heartTimerRef.current = setTimeout(() => setHeartPos(null), 900);
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        lastTap.current = 0;
      }, 320);
    }
  };

  const handleShare = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const id = String(post._raw_id || post.id);
    const shareData: SharePostData = {
        id,
        title: post.meta_title || localContent.slice(0, 72) || "Watch this Flick!",
        content: `${localContent.slice(0, 180)}${localContent.trim() ? "\n\n" : ""}via Flicks India`,
        media_url: post.media_url || post.video_url,
        image_url: post.image_url,
        image_urls: post.image_urls,
        video_url: post.video_url || post.media_url,
        cover_url: post.thumb_url || post.cover_url,
        meta_image: post.thumb_url || post.cover_url,
        type: "reel",
        author: post.author,
        meta_title: post.meta_title,
        meta_description: post.meta_description,
        shares_count: liveShares,
        metadata: post.metadata,
        thumb_url: post.thumb_url,
        thumbnail_url: post.thumbnail_url,
        poster_url: post.poster_url,
        preview_url: post.preview_url,
        video_thumbnail_url: post.video_thumbnail_url,
      };
    if (
      typeof window.AndroidShare?.shareMedia === "function" ||
      typeof window.AndroidShare?.shareText === "function"
    ) {
      void sharePost({
        postId: id,
        caption: localContent,
        mediaUrl: post.media_url || post.video_url || post.thumb_url || post.cover_url,
        mediaType: "video",
        authorName: post.author,
        metaTitle: post.meta_title,
        metaDescription: post.meta_description,
      })
        .then((outcome) => {
          if (outcome !== "cancelled") return completeShare(shareData);
        })
        .catch((error) => {
          console.error("[Flicks] Native share failed:", error);
          toast.error("Could not open the Android share sheet.");
        });
      return;
    }
    setSharePopupData({
      post: shareData,
      anchor: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    });
  };

  const completeShare = async (sharedPost: SharePostData) => {
    setSharePopupData(null);
    const pid = sharedPost.id;
    if (currentUserId) {
      const { error: shareError } = await supabase
        .from("shares")
        .insert({ post_id: pid, user_id: currentUserId });
      if (shareError) console.warn("[Flicks] share insert failed:", shareError.message);
    }
    const { count: shareCount, error: shareCountError } = await supabase
      .from("shares")
      .select("id", { count: "exact", head: true })
      .eq("post_id", pid);
    if (!shareCountError) {
      const accurateShareCount = Number(shareCount) || 0;
      setLiveShares(accurateShareCount);
      const { error: counterError } = await supabase
        .from("posts")
        .update({ shares_count: accurateShareCount })
        .eq("id", pid);
      if (counterError) console.warn("[Flicks] shares_count sync skipped:", counterError.message);
    }
    if (post.author_id && currentUserId && post.author_id !== currentUserId) {
      const { data: me } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUserId)
        .maybeSingle();
      const { error: notificationError } = await supabase.from("notifications").insert({
        notifier_id: post.author_id,
        actor_id: currentUserId,
        type: "share",
        entity_id: pid,
        content: JSON.stringify({
          text: `${me?.full_name || "Someone"} ne tumhara Reel share kiya.`,
          thumbnail_url: sharedPost.cover_url || sharedPost.meta_image || null,
        }),
        is_read: false,
      });
      if (notificationError) {
        console.warn("[Flicks] share notification failed:", notificationError.message);
      }
    }
  };

  const saveCaption = async () => {
    const trimmed = localContent.trim();
    if (!trimmed || savingCaption || !isOwner) return;
    const postId = String(post?._raw_id ?? "").trim();
    if (!postId) {
      toast.error("Could not determine the Reel database ID.");
      return;
    }

    setSavingCaption(true);
    const field = post._source === "flicks" ? "caption" : "content";
    try {
      const { data, error } = post._source === "flicks"
        ? await supabase.from("flicks").update({ [field]: trimmed }).eq("id", postId).select("id").maybeSingle()
        : await supabase.from("posts").update({ [field]: trimmed }).eq("id", postId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("The Reel was not updated. Check your permissions and try again.");

      setLocalContent(trimmed);
      setEditingCaption(false);
      window.dispatchEvent(new CustomEvent("flicks:reel-updated", {
        detail: { id: postId, [field]: trimmed, content: trimmed },
      }));
      toast.success("Reel updated.");
    } catch (error) {
      console.error("[Flicks] inline Reel edit failed:", error);
      toast.error(error instanceof Error ? error.message : "Reel could not be updated.");
    } finally {
      setSavingCaption(false);
    }
  };

  const handleReport = async () => {
    if (!currentUserId) { toast.error("Please login"); return; }
    if (!reportText.trim()) return;
    setReporting(true);
    try {
      const { data: rd } = await supabase.from("reports").insert({
        reporter_id: currentUserId, reported_user_id: post.author_id,
        post_id: post._raw_id, reason: reportText.trim(), status: "pending",
      }).select("id").single();
      await supabase.from("notifications").insert({
        notifier_id: currentUserId, actor_id: currentUserId, type: "report_submitted",
        entity_id: rd?.id ?? post._raw_id,
        entity_type: rd?.id ? "report" : "post",
        content: "Your report is under review. We'll notify you once a decision is made.", is_read: false,
      });
      toast.success("✅ Report submitted.");
      setReportOpen(false); setReportText("");
    } catch { toast.error("Could not submit report"); }
    finally { setReporting(false); }
  };

  const deletePostRow = async (): Promise<string> => {
    const postId = String(post?._raw_id ?? "").trim();
    if (!postId) {
      throw new Error("Could not determine the Reel database ID.");
    }

    // Avoid DELETE ... RETURNING: Supabase may apply a valid delete while RLS
    // prevents returning the deleted row to the client.
    const result = post?._source === "flicks"
      ? await supabase.from("flicks").delete().eq("id", postId)
      : await supabase.from("posts").delete().eq("id", postId);
    const { error } = result;
    if (error) throw error;

    // Detect a silent RLS no-op where the row is still visible. If SELECT
    // itself is restricted, trust the successful DELETE response instead.
    const remaining = post?._source === "flicks"
      ? await supabase.from("flicks").select("id").eq("id", postId).maybeSingle()
      : await supabase.from("posts").select("id").eq("id", postId).maybeSingle();
    if (!remaining.error && remaining.data) {
      throw new Error("The Reel could not be deleted. Check your permissions and try again.");
    }
    return postId;
  };

  const getDeleteErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null && "message" in error) {
      return String(error.message);
    }
    return "Reel could not be deleted.";
  };

  const handleAdminDelete = async () => {
    setMenuOpen(false);
    if (!isAdmin || deleting) return;
    if (!window.confirm("ADMIN: Delete this video permanently?")) return;
    {vibe.primary && (
            <div className="mb-1 inline-flex items-center rounded-full border border-white/15 bg-black/40 px-2 py-1">
              <span
                className="text-[10px] font-extrabold"
                style={{ color: vibe.primary.glowColor }}
              >
                {vibe.primary.icon} {vibe.primary.label}
                {vibe.matches.some((profile) => profile.tag !== vibe.primary?.tag) ? " +" : ""}
              </span>
            </div>
          )}

          {/* Multi-line description */}
          {editingCaption ? (
            <div onClick={e => e.stopPropagation()}>
              <textarea
                className="w-full bg-black/60 backdrop-blur-md border border-white/30 rounded-xl px-3 py-2 text-sm text-white outline-none resize-none"
                style={{ fontSize: 16 }}
                rows={2} value={localContent} onChange={e => setLocalContent(e.target.value)} autoFocus />
              <div className="flex gap-2 mt-1.5">
                <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setLocalContent(getPostCaption(post)); setEditingCaption(false); }}
                  className="flex-1 py-1.5 rounded-xl bg-white/15 text-white/80 text-[11px] font-bold">Cancel</button>
                <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); void saveCaption(); }}
                  disabled={savingCaption}
                  className="flex-1 py-1.5 rounded-xl text-white text-[11px] font-bold disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#E11D48,#A01030)" }}>
                  {savingCaption ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11.5px] text-white drop-shadow-md line-clamp-2 leading-snug font-medium" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>{localContent}</p>
          )}

          {/* Single-line music title — transparent crimson outline effect */}
          <p
            className="mt-1 text-[11px] font-black tracking-wide truncate select-none"
            style={{
              color: "transparent",
              WebkitTextStroke: "0.7px rgba(255,45,85,0.95)",
              textShadow: "0 0 12px rgba(225,29,72,0.40)",
            }}>
            ♪ {musicTitle}
          </p>

          {/* Miniature spinning cassette + scrolling song title — nested in the panel's bottom corner */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <AudioCassette spinning={isActive && !editingCaption} compact />
            <div className="shrink-0 w-px h-3 rounded-full"
              style={{ background: "rgba(255,120,20,0.6)", boxShadow: "0 0 5px rgba(255,120,20,0.6)" }} />
            <Ticker text={tickerText} isActive={isActive && !editingCaption} />
          </div>
        </div>
      </div>

      {/* ── Report Modal (portal) ── */}
      {createPortal(
        <AnimatePresence>
          {reportOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: 99998 }}
                onClick={() => setReportOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                style={{ position: "fixed", top: reportAnchor?.top ?? 120, right: reportAnchor?.right ?? 16, zIndex: 99999 }}
                className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center"><Flag size={15} className="text-orange-500" /></div>
                    <span className="text-gray-900 font-black text-sm">Report Video</span>
                  </div>
                  <button onClick={() => setReportOpen(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><X size={14} /></button>
                </div>
                <p className="text-gray-500 text-xs mb-3">Help us keep Flicks India safe.</p>
                <textarea value={reportText} onChange={e => setReportText(e.target.value)}
                  placeholder="Describe the issue…" rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-orange-400 resize-none" />
                <button onClick={handleReport} disabled={reporting || !reportText.trim()}
                  className="w-full mt-3 py-3 rounded-2xl font-black text-white text-sm disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
                  {reporting ? "Submitting…" : "Submit Report"}
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Comments (portal) ── */}
      {createPortal(
        <AnimatePresence>
          {showComments && isActive && (
            <>
              <div
                data-no-media-playback-retry="true"
                className="fixed inset-0 z-[9999] bg-black/40"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowComments(false);
                }}
              />
              <CommentBox
                post={post}
                currentUserId={currentUserId}
                onClose={() => setShowComments(false)}
                onCommentAdded={() => setLiveCommentsCount(prev => prev + 1)}
                onCommentDeleted={() => setLiveCommentsCount(prev => Math.max(prev - 1, 0))}
              />
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
      {sharePopupData && createPortal(
        <SharePopup
          post={sharePopupData.post}
          anchor={sharePopupData.anchor}
          onClose={() => setSharePopupData(null)}
          onShare={(_mode, sharedPost) => void completeShare(sharedPost)}
        />,
        document.body,
      )}
      {confirmDeleteOpen && (
        <div
          className="absolute inset-0 z-[100] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="flicks-delete-title"
            aria-describedby="flicks-delete-description"
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="flicks-delete-title" className="text-base font-black text-white">Delete this Reel?</h2>
            <p id="flicks-delete-description" className="mt-2 text-sm leading-relaxed text-white/60">
              This permanently removes the Reel from your feed.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); setConfirmDeleteOpen(false); }}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/75 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); void handleOwnerDelete(); }}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete Reel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Main FlicksApp ────────────────────────────────────────────────────────────
type FlicksAppProps = {
  onBack?: () => void;
  onBridgeChat?: (userId: string) => void;
  onEditReel?: (post: FlickPostRow) => void;
  initialPostId?: string;
  isAdmin?: boolean;
  currentUserEmail?: string;
  currentUserId?: string;
};

export default function FlicksApp({
  onBack,
  onBridgeChat,
  onEditReel,
  initialPostId,
  isAdmin: isAdminProp = false,
  currentUserEmail: currentUserEmailProp,
  currentUserId: currentUserIdProp,
}: FlicksAppProps) {
  const dataCache    = useDataCache();
  const cachedFlicks = dataCache.cacheRef.current.flicksFeed;
  const [persistedFlicks] = useState(() => readPersistedFlicks());
  const initialFlicks = cachedFlicks?.data ?? persistedFlicks;
  const cachedVisibleFlicks = initialFlicks.filter(
    (post: FlickPostRow) =>
      (post.visibility || "public") === "public" &&
      post.author_profile?.is_private_mode !== true &&
      isBunnyVideoVisibleToViewer(post, currentUserIdProp ?? null),
  );
  const [flicks,       setFlicks]       = useState<FlickPostRow[]>(() =>
    cachedVisibleFlicks.map((post: FlickPostRow) => ({
      ...post,
      content: getPostCaption(post),
    })),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading,      setLoading]      = useState(() => cachedVisibleFlicks.length === 0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(currentUserIdProp ?? null);
  const [fetchedEmail,  setFetchedEmail]  = useState<string | null>(currentUserEmailProp ?? null);
  const [profileAdminUserId, setProfileAdminUserId] = useState<string | null>(null);
  const isAdmin =
    isAdminProp ||
    isAdminEmail(currentUserEmailProp) ||
    isAdminEmail(fetchedEmail) ||
    profileAdminUserId === currentUserId;
  const containerRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(0);
  const commentDrawerOpenRef = useRef(false);
  const pendingDeleteSnapshotsRef = useRef(
    new Map<string, { item: FlickPostRow; index: number; currentIndex: number }>(),
  );
  const scrollRafRef = useRef<number>(0);
  const pullDistanceRef = useRef(0);
  const reelsRefreshingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [reelsRefreshing, setReelsRefreshing] = useState(false);

  // Compact header search — client-side filter over author + caption
  const [searchQuery, setSearchQuery] = useState("");
  const visibleFlicks = useMemo(() => {
    const viewerFlicks = flicks.filter((post: FlickPostRow) =>
      isBunnyVideoVisibleToViewer(post, currentUserId),
    );
    const q = searchQuery.trim().toLowerCase();
    if (!q) return viewerFlicks;
    return viewerFlicks.filter((f: FlickPostRow) =>
      String(f.author || "").toLowerCase().includes(q) ||
      String(f.content || "").toLowerCase().includes(q),
    );
  }, [currentUserId, flicks, searchQuery]);

  // Inject CSS keyframes once on mount
  useEffect(() => { injectFlicksStyles(); }, []);

  useEffect(() => {
    const onDrawerState = (event: Event) => {
      const open = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open);
      commentDrawerOpenRef.current = open;
      if (open) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };
    window.addEventListener("flicks:comment-drawer-state", onDrawerState);
    return () => window.removeEventListener("flicks:comment-drawer-state", onDrawerState);
  }, []);

  useEffect(() => {
    const userId = currentUserId;
    if (!userId) {
      setProfileAdminUserId(null);
      return;
    }

    let cancelled = false;
    fetchProfileAdminFlag(userId)
      .then((isProfileAdmin) => {
        if (!cancelled) setProfileAdminUserId(isProfileAdmin ? userId : null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProfileAdminUserId(null);
        console.warn("[Flicks] profile admin check failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const loadPosts = (projection: string) =>
          supabase
            .from("posts")
            .select(projection)
            .in("type", ["video", "reel"])
            .order("created_at", { ascending: false })
            .limit(30);
        let projection = FLICKS_POST_PROJECTION_WITH_AUDIO;
        let postsResult = await loadPosts(projection);
        if (isMissingAudioUrlColumn(postsResult.error)) {
          projection = FLICKS_POST_PROJECTION;
          postsResult = await loadPosts(projection);
        }
        if (postsResult.error) throw postsResult.error;
        const rows: FlickPostRow[] = [...(postsResult.data || [])] as unknown as FlickPostRow[];

        // A FameFeed video can be older than the default 30-reel window. Fetch
        // that selected post explicitly so the viewer can still open on it.
        if (initialPostId && !rows.some((row) => row.id === initialPostId)) {
          const loadSelectedPost = (selectedProjection: string) =>
            supabase
              .from("posts")
              .select(selectedProjection)
              .eq("id", initialPostId)
              .maybeSingle();
          let selectedResult = await loadSelectedPost(projection);
          if (
            isMissingAudioUrlColumn(selectedResult.error) &&
            projection !== FLICKS_POST_PROJECTION
          ) {
            projection = FLICKS_POST_PROJECTION;
            selectedResult = await loadSelectedPost(projection);
          }
          if (selectedResult.error) {
            console.warn(
              "[Flicks] selected FameFeed video could not be loaded:",
              selectedResult.error.message,
            );
          } else if (selectedResult.data) {
            rows.push(selectedResult.data as unknown as FlickPostRow);
          }
        }

        const supportedRows = Array.from(
          new Map<string, FlickPostRow>(
            rows
              .filter((row) => isSupportedVideoUrl(row.media_url, row.metadata))
              .filter(
                (row) =>
                  row.id === initialPostId ||
                  ((row.visibility || "public") === "public" &&
                    row.author_profile?.is_private_mode !== true),
              )
              .map((row): [string, FlickPostRow] => [String(row.id), row]),
          ).values(),
        ).sort((left, right) =>
          new Date(right.created_at || 0).getTime() -
          new Date(left.created_at || 0).getTime(),
        );
        const viewerId = currentUserIdProp ?? null;
        const bunnyIds = supportedRows
          .map((row) => getPostBunnyVideoId(row))
          .filter((id): id is string => Boolean(id));
        const readiness = await fetchBunnyVideoReadiness(bunnyIds);
        const visibleRows = supportedRows
          .filter((row) => {
            const videoId = getPostBunnyVideoId(row);
            const isCreator = Boolean(viewerId && row.author_id === viewerId);
            return !videoId || isCreator || readiness.get(videoId) === true;
          })
          .map((row) => {
            const videoId = getPostBunnyVideoId(row);
            return {
              ...row,
              bunny_ready: videoId
                ? readiness.get(videoId) === true
                : undefined,
            };
          });
        const postIds = visibleRows.map((row: FlickPostRow) => row.id).filter(Boolean);

        const normalized = visibleRows.map((p: FlickPostRow) => {
          const settings = getReelSettings(p);
          const isAdminPost = p.is_admin_post === true;
          return {
            id: `post_${p.id}`,
            _raw_id: p.id,
            _source: "posts",
            user_id: p.author_id || p.user_id,
            author_id: p.author_id || p.user_id,
            author: p.author_profile?.full_name || p.author || "User",
            author_avatar: p.author_profile?.avatar_url || null,
            content: getPostCaption(p),
            media_url: settings.videoUrl || p.media_url,
            video_url: settings.videoUrl || p.media_url,
            audio_url: settings.audioUrl,
            filters: settings.filter,
            playback_rate: settings.playbackRate,
            metadata: p.metadata,
            visibility: p.visibility || "public",
            is_admin_post: isAdminPost,
            author_profile: p.author_profile ?? null,
            bunny_ready: p.bunny_ready,
            image_url: p.image_url || null,
            image_urls: p.image_urls,
            thumb_url: p.cover_url || p.thumb_url || null,
            likes_count: Math.max(Number(p.likes_count) || 0, 0),
            views_count: p.views_count || 0,
            comments_count: Math.max(Number(p.comments_count) || 0, 0),
            shares_count: Math.max(Number(p.shares_count) || 0, 0),
            liked_by_me: false,
            meta_title: p.meta_title || null,
            meta_description: p.meta_description || null,
            created_at: p.created_at,
          };
        });

        if (cancelled) return;
        setFlicks(normalized);
        dataCache.setCache("flicksFeed", { data: normalized, fetchedAt: Date.now() });
        persistFlicks(normalized);
        setLoading(false);

        void (async () => {
          try {
            const viewerId = currentUserIdProp ?? null;
            if (cancelled || postIds.length === 0) return;
            setCurrentUserId(viewerId);

            const { data: engagementRows, error: engagementError } = await supabase.rpc(
              "get_post_engagement_counts",
              { p_post_ids: postIds, p_viewer_id: viewerId },
            );
            if (cancelled) return;

            const engagementByPost = new Map<
              string,
              { post_id: string; likes_count?: number; comments_count?: number; shares_count?: number; views_count?: number }
            >(
              (Array.isArray(engagementRows) ? engagementRows : []).map((row) => [
                row.post_id,
                row,
              ]),
            );
            let likedIds = new Set<string>();
            if (engagementError) {
              console.warn(
                "[Flicks] aggregate counts unavailable; using post counters:",
                engagementError.message,
              );
              if (viewerId) {
                const { data: likedRows, error: likedError } = await supabase
                  .from("likes")
                  .select("post_id")
                  .eq("user_id", viewerId)
                  .in("post_id", postIds)
                  .limit(postIds.length);
                if (likedError) {
                  console.warn("[Flicks] viewer like state fetch failed:", likedError.message);
                } else {
                  likedIds = new Set((likedRows || []).map((row) => row.post_id));
                }
              }
            }
            setFlicks((previous) => {
              const refreshed = previous.map((item) => {
                if (!postIds.includes(item._raw_id)) return item;
                const engagement = engagementByPost.get(item._raw_id);
                return {
                  ...item,
                  liked_by_me: engagementError
                    ? likedIds.has(item._raw_id)
                    : likedIds.has(item._raw_id),
                  likes_count: engagementError
                    ? item.likes_count
                    : Number(engagement?.likes_count) || 0,
                  comments_count: engagementError
                    ? item.comments_count
                    : Number(engagement?.comments_count) || 0,
                  shares_count: engagementError
                    ? item.shares_count
                    : Number(engagement?.shares_count) || 0,
                };
              });
              dataCache.setCache("flicksFeed", {
                data: refreshed,
                fetchedAt: Date.now(),
              });
              return refreshed;
            });
          } catch (error) {
            console.error("[Flicks] engagement state refresh failed:", error);
          }
        })();
      } catch (err) {
        if (!cancelled) console.error("[FlicksApp] fetch error:", err);
        if (!cancelled) setLoading(false);
      }
    };

    const container = containerRef.current;
    const isAtTop = () =>
      Boolean(
        container &&
        currentIndexRef.current === 0 &&
        container.scrollTop === 0,
      );
    let touchStart: { x: number; y: number } | null = null;
    let startedAtTop = false;
    let gesture: "undecided" | "pulling" | "blocked" = "blocked";
    const resetPull = () => {
      touchStart = null;
      startedAtTop = false;
      gesture = "blocked";
      pullDistanceRef.current = 0;
      if (!cancelled) setPullDistance(0);
    };
    const refreshReels = async () => {
      if (reelsRefreshingRef.current) return;
      reelsRefreshingRef.current = true;
      if (!cancelled) setReelsRefreshing(true);
      try {
        await fetchData();
      } finally {
        reelsRefreshingRef.current = false;
        if (!cancelled) setReelsRefreshing(false);
        resetPull();
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        commentDrawerOpenRef.current ||
        event.touches.length !== 1 ||
        reelsRefreshingRef.current ||
        !isAtTop() ||
        target?.closest('button, a, input, textarea, select, [contenteditable], [data-no-pull-refresh], [role="dialog"], [data-no-media-playback-retry]')
      ) {
        resetPull();
        return;
      }
      startedAtTop = true;
      touchStart = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
      gesture = "undecided";
      pullDistanceRef.current = 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (commentDrawerOpenRef.current) {
        resetPull();
        return;
      }
      if (!touchStart || !startedAtTop || event.touches.length !== 1) return;
      if (!isAtTop()) {
        gesture = "blocked";
        pullDistanceRef.current = 0;
        if (!cancelled) setPullDistance(0);
        return;
      }
      const dx = event.touches[0].clientX - touchStart.x;
      const dy = event.touches[0].clientY - touchStart.y;
      const directionLock = 8;
      if (Math.abs(dx) > Math.abs(dy) || dy <= 0) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= directionLock) {
          gesture = "blocked";
          pullDistanceRef.current = 0;
          if (!cancelled) setPullDistance(0);
        }
        return;
      }
      if (dy < directionLock || gesture === "blocked") return;
      gesture = "pulling";
      pullDistanceRef.current = dy;
      if (event.cancelable) event.preventDefault();
      if (!cancelled) setPullDistance(Math.min(dy, 100));
    };
    const onTouchEnd = () => {
      const shouldRefresh =
        !commentDrawerOpenRef.current &&
        gesture === "pulling" &&
        startedAtTop &&
        isAtTop() &&
        pullDistanceRef.current >= 72 &&
        !reelsRefreshingRef.current;
      if (shouldRefresh) void refreshReels();
      else resetPull();
    };
    const onTouchCancel = () => resetPull();
    const onRefreshEvent = (event: Event) => {
      const complete = (event as CustomEvent<{ complete?: () => void }>).detail?.complete;
      void fetchData().finally(() => complete?.());
    };

    setCurrentUserId(currentUserIdProp ?? null);
    setFetchedEmail(currentUserEmailProp ?? null);
    void fetchData();
    container?.addEventListener("touchstart", onTouchStart, { passive: true });
    container?.addEventListener("touchmove", onTouchMove, { passive: false });
    container?.addEventListener("touchend", onTouchEnd, { passive: true });
    container?.addEventListener("touchcancel", onTouchCancel, { passive: true });
    window.addEventListener("flicks-reels-pull-refresh", onRefreshEvent);
    return () => {
      cancelled = true;
      container?.removeEventListener("touchstart", onTouchStart);
      container?.removeEventListener("touchmove", onTouchMove);
      container?.removeEventListener("touchend", onTouchEnd);
      container?.removeEventListener("touchcancel", onTouchCancel);
      window.removeEventListener("flicks-reels-pull-refresh", onRefreshEvent);
    };
  }, [currentUserIdProp, currentUserEmailProp, initialPostId]);

  // RAF-throttled scroll → update active index
  const scrollTicking = useRef(false);
  const onScroll = useCallback(() => {
    if (commentDrawerOpenRef.current) return;
    if (scrollTicking.current) return;
    scrollTicking.current = true;
    scrollRafRef.current = requestAnimationFrame(() => {
      if (commentDrawerOpenRef.current) {
        scrollTicking.current = false;
        scrollRafRef.current = 0;
        return;
      }
      if (containerRef.current) {
        const idx = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        if (idx !== currentIndexRef.current) {
          currentIndexRef.current = idx;
          setCurrentIndex(idx);
        }
      }
      scrollTicking.current = false;
      scrollRafRef.current = 0;
    });
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = 0;
    scrollTicking.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("resize", onScroll, { passive: true });
    return () => window.removeEventListener("resize", onScroll);
  }, [onScroll]);

  useEffect(() => {
    if (visibleFlicks.length === 0 || currentIndex < visibleFlicks.length) return;
    const nextIndex = visibleFlicks.length - 1;
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
  }, [currentIndex, visibleFlicks.length]);

  // Keep the next two attached tracks warm; the mounted video cards preload
  // their own media directly, avoiding full-file blob downloads.
  useEffect(() => {
    visibleFlicks.slice(currentIndex, currentIndex + 3).forEach((f: any) => {
      const audio = getReelSettings(f).audioUrl;
      if (audio) prefetchReelMedia(audio);
    });
  }, [visibleFlicks, currentIndex]);

  // FameFeed handoff — jump straight to the tapped video when the overlay
  // opens with an initialPostId (Facebook-style transition).
  const initialScrollDoneRef = useRef(false);
  useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [initialPostId]);
  useEffect(() => {
    if (!initialPostId || loading || initialScrollDoneRef.current) return;
    const el = containerRef.current;
    if (!el || visibleFlicks.length === 0) return;
    const idx = visibleFlicks.findIndex(
      (f: any) => f._raw_id === initialPostId || f.id === initialPostId,
    );
    if (idx < 0) return;
    initialScrollDoneRef.current = true;
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
    el.scrollTop = idx * el.clientHeight;
  }, [initialPostId, loading, visibleFlicks]);

  // Handle notification tap: scroll to post/reel in feed and optionally expand comments
  useEffect(() => {
    const handleOpenPostInFeed = (event: Event) => {
      const detail = (event as CustomEvent<{ postId?: string; type?: string }>).detail;
      const postId = detail?.postId;
      if (!postId) return;

      // Scroll to the post in the feed
      if (!containerRef.current || visibleFlicks.length === 0) return;
      const idx = visibleFlicks.findIndex(
        (f: any) => f._raw_id === postId || f.id === postId,
      );
      if (idx < 0) return;
      currentIndexRef.current = idx;
      setCurrentIndex(idx);
      containerRef.current.scrollTop = idx * containerRef.current.clientHeight;

      // For comment notifications, we could expand comments - but FlicksFeed doesn't have inline comments UI yet
      // This could be enhanced later to open comment sheet
    };
    window.addEventListener("flicks:open-post-in-feed", handleOpenPostInFeed as EventListener);
    return () => window.removeEventListener("flicks:open-post-in-feed", handleOpenPostInFeed as EventListener);
  }, [visibleFlicks]);

  const handlePostDeleteOptimistic = useCallback((rawId: string, fallbackPost: any) => {
    const index = flicks.findIndex((item) => item._raw_id === rawId);
    if (index < 0) return;

    const previousIndex = currentIndexRef.current;
    pendingDeleteSnapshotsRef.current.set(rawId, {
      item: flicks[index] ?? fallbackPost,
      index,
      currentIndex: previousIndex,
    });

    const next = flicks.filter((item) => item._raw_id !== rawId);
    const nextIndex = index < previousIndex
      ? previousIndex - 1
      : Math.min(previousIndex, Math.max(next.length - 1, 0));
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    setFlicks(next);
    dataCache.setCache("flicksFeed", { data: next, fetchedAt: Date.now() });
  }, [dataCache, flicks]);

  const handlePostDeleteRollback = useCallback((rawId: string) => {
    const snapshot = pendingDeleteSnapshotsRef.current.get(rawId);
    if (!snapshot) return;
    pendingDeleteSnapshotsRef.current.delete(rawId);

    setFlicks((previous) => {
      if (previous.some((item) => item._raw_id === rawId)) return previous;
      const next = [...previous];
      next.splice(Math.min(snapshot.index, next.length), 0, snapshot.item);
      dataCache.setCache("flicksFeed", { data: next, fetchedAt: Date.now() });
      return next;
    });
    const restoredIndex = Math.min(
      snapshot.currentIndex,
      Math.max(flicks.length - 1, 0),
    );
    currentIndexRef.current = restoredIndex;
    setCurrentIndex(restoredIndex);
    const container = containerRef.current;
    if (container) container.scrollTop = restoredIndex * container.clientHeight;
  }, [dataCache, flicks.length]);

  const handlePostDeleted = useCallback((rawId: string) => {
    pendingDeleteSnapshotsRef.current.delete(rawId);
    setFlicks((previous) => {
      const next = previous.filter((item) => item._raw_id !== rawId);
      dataCache.setCache("flicksFeed", { data: next, fetchedAt: Date.now() });
      return next;
    });
  }, [dataCache]);

  useEffect(() => {
    const handleReelUpdated = (event: Event) => {
      const updated = (event as CustomEvent<any>).detail;
      if (!updated?.id) return;
      const settings = getReelSettings(updated);
      setFlicks((previous) => {
        const next = previous.map((item) =>
          item._raw_id === updated.id || item.id === `post_${updated.id}`
            ? {
                ...item,
                ...updated,
                content: getPostCaption({ ...item, ...updated }),
                media_url: settings.videoUrl || updated.media_url || item.media_url,
                video_url: settings.videoUrl || updated.video_url || item.video_url,
                audio_url: settings.audioUrl,
                filters: settings.filter,
                playback_rate: settings.playbackRate,
              }
            : item,
        );
        dataCache.setCache("flicksFeed", { data: next, fetchedAt: Date.now() });
        return next;
      });
    };

    const handleReelCreated = (event: Event) => {
      const created = (event as CustomEvent<any>).detail;
      if (!created?.id || created.type !== "video") return;
      const settings = getReelSettings(created);
      const isAdminPost = created.is_admin_post === true;
      const normalized = {
        ...created,
        id: `post_${created.id}`,
        _raw_id: created.id,
        _source: "posts",
        user_id: created.author_id,
        author_id: created.author_id,
        author: created.author || "User",
        is_admin_post: isAdminPost,
        content: getPostCaption(created),
        media_url: settings.videoUrl || created.media_url,
        video_url: settings.videoUrl || created.video_url || created.media_url,
        audio_url: settings.audioUrl,
        filters: settings.filter,
        playback_rate: settings.playbackRate,
        likes_count: Number(created.likes_count) || 0,
        comments_count: Number(created.comments_count) || 0,
        shares_count: Number(created.shares_count) || 0,
      };
      setFlicks((previous) => {
        const next = [normalized, ...previous.filter((item) => item._raw_id !== created.id)];
        dataCache.setCache("flicksFeed", { data: next, fetchedAt: Date.now() });
        return next;
      });
    };

    window.addEventListener("flicks:reel-updated", handleReelUpdated);
    window.addEventListener("flicks:post-created", handleReelCreated);
    return () => {
      window.removeEventListener("flicks:reel-updated", handleReelUpdated);
      window.removeEventListener("flicks:post-created", handleReelCreated);
    };
  }, [dataCache]);

  if (loading)
    return (
      <div className="h-screen bg-black" aria-label="Loading reels" />
    );

  return (
    <div className="fixed inset-0 bg-black z-[100]" style={{ touchAction: "pan-y" }}>
      {/* ── Translucent safe-area header — back · centered "Reels" · compact search ── */}
      <div
        className="fixed top-0 left-0 right-0 z-[120]"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          background: "rgba(11,10,14,0.55)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="relative flex items-center justify-between h-12 px-3">
          {onBack ? (
            <button
              onClick={onBack}
              aria-label="Back"
              className="w-9 h-9 -ml-1 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={22} className="text-white/85" />
            </button>
          ) : (
            <span className="w-9 h-9" />
          )}
          {/* Centered title — clean bold white/red accent */}
          <p
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[16px] font-black tracking-[0.1em]"
            style={{
              background: "linear-gradient(90deg,#ffffff 35%,#FF4D6D 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 0 10px rgba(255,45,85,0.45))",
            }}
          >
            Reels
          </p>
          {/* Compact search pill — far right, inside the safe area */}
          <div
            className="flex items-center gap-1.5 rounded-full pl-2.5 pr-3 h-8 shrink-0"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.10)",
              width: 124,
            }}
          >
            <Search size={13} className="text-white/55 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search reels"
              className="w-full min-w-0 bg-transparent text-white outline-none placeholder:text-white/45"
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
      </div>

      {(pullDistance > 0 || reelsRefreshing) && (
        <div
          className="fixed left-1/2 z-[220] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/85 px-3 py-2 text-[11px] font-semibold text-white shadow-lg"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 58px)", pointerEvents: "none" }}
          role={reelsRefreshing ? "status" : undefined}
          aria-live={reelsRefreshing ? "polite" : undefined}
        >
          <RefreshCw
            size={14}
            className={reelsRefreshing ? "animate-spin text-pink-300" : "text-white/70"}
            style={!reelsRefreshing ? { transform: `rotate(${Math.min(pullDistance / 72, 1) * 360}deg)` } : undefined}
          />
          {reelsRefreshing
            ? "Refreshing reels…"
            : pullDistance >= 72
              ? "Release to refresh"
              : "Pull to refresh"}
        </div>
      )}

      <div ref={containerRef} onScroll={onScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ touchAction: "pan-y" }}>
        {visibleFlicks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/20 font-bold">
            {searchQuery.trim() ? "NO REELS MATCH YOUR SEARCH." : "NO VIDEOS FOUND."}
          </div>
        ) : (
          visibleFlicks.map((f, i) => {
            // Keep the requested preload window mounted without rendering the full feed.
            const isNear = i >= currentIndex - 1 && i <= currentIndex + 2;
            if (!isNear) {
              return <div key={f.id} className="w-full h-full bg-black snap-start snap-always shrink-0" />;
            }
            return (
              <React.Fragment key={f.id}>
                <FlickCard
                  post={f}
                  isActive={i === currentIndex}
                  isPreloaded={isNear}
                  isNext={i === currentIndex + 1}
                  isWarmNext={i === currentIndex + 2}
                  currentUserId={currentUserId}
                  onBridgeChat={onBridgeChat}
                  onEditReel={onEditReel}
                  isAdmin={isAdmin}
                  onPostDeleted={handlePostDeleted}
                  onPostDeleteOptimistic={handlePostDeleteOptimistic}
                  onPostDeleteRollback={handlePostDeleteRollback}
                  onUserBanned={(authorId: string) => setFlicks(prev => prev.filter(x => x.author_id !== authorId))}
                  onVideoInvalid={(id: string) => setFlicks(prev => prev.filter(x => x.id !== id))}
                />
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}