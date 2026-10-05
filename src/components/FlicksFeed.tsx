import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useDataCache } from "../context/DataCacheContext";
import { useOnlineUsers } from "../context/OnlineUsersContext";
import { isAdminEmail } from "../lib/adminConfig";
import { fetchProfileAdminFlag } from "../lib/adminProfile";
import { useSoundEffects } from "../hooks/useSoundEffects";
import {
  Heart, MessageCircle, Share2, Plus, X, Send,
  BadgeCheck, Loader2, Flag, Trash2, Ban, Pencil, MoreVertical,
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
import VibeAudioToggle from "./VibeAudioToggle";
import ActiveStatusAvatar from "./ActiveStatusAvatar";

// ── Utilities ─────────────────────────────────────────────────────────────────
const formatCount = (n: any): string => {
  const num = Number(n);
  if (!num || isNaN(num)) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (num >= 1_000)     return (num / 1_000).toFixed(num >= 10_000 ? 0 : 1).replace(".0", "") + "K";
  return String(num);
};

const SUPPORTED_VIDEO_EXTENSIONS = /\.(mp4|webm)(?:$|[?#])/i;
const FLICKS_POST_PROJECTION =
  "id, author, author_id, content, media_url, type, metadata, cover_url, views_count, likes_count, comments_count, shares_count, meta_title, meta_description, created_at, author_profile:profiles!posts_author_id_fkey(avatar_url, full_name)";
const FLICKS_POST_PROJECTION_WITH_AUDIO = `${FLICKS_POST_PROJECTION}, audio_url`;

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

const isSupportedVideoUrl = (url: unknown, metadata?: any): boolean => {
  if (typeof url !== "string" || !url.trim()) return false;
  const declaredMime = String(
    metadata?.mime_type || metadata?.mimeType || metadata?.content_type || "",
  ).toLowerCase();
  if (declaredMime === "video/mp4" || declaredMime === "video/webm") return true;
  return SUPPORTED_VIDEO_EXTENSIONS.test(url);
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

// ── Spinning Cassette SVG ─────────────────────────────────────────────────────
const Reel = ({ cx, cy, spinning }: { cx: number; cy: number; spinning: boolean }) => (
  <>
    <circle cx={cx} cy={cy} r={4.2} fill="#0d0d22" stroke="rgba(0,255,230,0.45)" strokeWidth="0.9" />
    <circle cx={cx} cy={cy} r={1.6} fill="rgba(0,255,230,0.75)" />
    <g style={{
      transformOrigin: `${cx}px ${cy}px`,
      animation: spinning ? "flick-reel 0.85s linear infinite" : "none",
    }}>
      <line x1={cx}       y1={cy - 4.2} x2={cx}       y2={cy - 1.9} stroke="rgba(0,255,230,0.6)" strokeWidth="0.85" />
      <line x1={cx + 3.6} y1={cy - 2.1} x2={cx + 1.6} y2={cy - 0.9} stroke="rgba(0,255,230,0.6)" strokeWidth="0.85" />
      <line x1={cx + 3.6} y1={cy + 2.1} x2={cx + 1.6} y2={cy + 0.9} stroke="rgba(0,255,230,0.6)" strokeWidth="0.85" />
    </g>
  </>
);

const AudioCassette = ({ spinning }: { spinning: boolean }) => (
  <svg width="40" height="28" viewBox="0 0 40 28" fill="none" className="shrink-0">
    {/* Body */}
    <rect x="0.5" y="0.5" width="39" height="27" rx="3.5" fill="#09091f" stroke="rgba(0,255,230,0.35)" strokeWidth="1" />
    {/* Tape window */}
    <rect x="7.5" y="7" width="25" height="14" rx="2" fill="#040413" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
    {/* Reels */}
    <Reel cx={13} cy={14} spinning={spinning} />
    <Reel cx={27} cy={14} spinning={spinning} />
    {/* Center hub bar */}
    <rect x="15.5" y="13.2" width="9" height="1.6" rx="0.8" fill="rgba(0,255,230,0.2)" />
    {/* Screw holes */}
    <circle cx={4}  cy={4}  r={1.4} fill="#111128" />
    <circle cx={36} cy={4}  r={1.4} fill="#111128" />
    <circle cx={4}  cy={24} r={1.4} fill="#111128" />
    <circle cx={36} cy={24} r={1.4} fill="#111128" />
    {/* Label strip */}
    <rect x="9" y="21.5" width="22" height="3" rx="1.2" fill="rgba(0,255,230,0.12)" />
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
        <span className="text-[11px] font-bold text-white/80 tracking-wide">{text}</span>
        <span className="text-[11px] font-bold text-white/80 tracking-wide" style={{ marginLeft: "5rem" }}>{text}</span>
      </div>
    </div>
  );
};

// ── Comment Drawer ────────────────────────────────────────────────────────────
const CommentDrawer = ({ post, currentUserId, onClose, onCommentAdded }: any) => {
  const onlineUserIds = useOnlineUsers();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const sounds = useSoundEffects();

  useEffect(() => {
    if (!post?._raw_id) return;
    let cancelled = false;
    supabase
      .from("comments")
      .select("id, post_id, content, user_id, author, created_at, profiles:user_id(username, full_name, avatar_url)")
      .eq("post_id", post._raw_id)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[Flicks] comment fetch failed:", error.message);
          return;
        }
        setComments(data || []);
      });
    return () => { cancelled = true; };
  }, [post?._raw_id]);

  const handleSend = async () => {
    if (!text.trim() || !currentUserId) { toast.error("Please login to comment"); return; }
    setSending(true);
    sounds?.playSwoosh?.();
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert([{ post_id: post._raw_id, content: text.trim(), user_id: currentUserId, author: "User" }])
          .select("id, post_id, content, user_id, author, created_at, profiles:user_id(username, full_name, avatar_url)")
        .single();
      if (error) throw error;
      if (data) {
        setComments(p => [...p, data]);
        setText("");
        const { count, error: countError } = await supabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .eq("post_id", post._raw_id);
        toast.success("Commented!");
        onCommentAdded?.(countError ? comments.length + 1 : Number(count) || 0);
      }
    } catch { toast.error("Comment send nahi hua"); }
    finally { setSending(false); }
  };

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl z-[205] h-[70vh] flex flex-col border-t border-white/10 shadow-2xl"
      onClick={e => e.stopPropagation()}>
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
        <span className="text-white font-bold text-lg">{comments.length} Comments</span>
        <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-white/50"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {comments.length === 0 && <p className="text-white/20 text-center py-10">Pehla comment aap karein!</p>}
        {comments.map((c, i) => {
          const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          const commentUsername = profile?.username || profile?.full_name || "User";
          return (
          <div key={c.id || i} className="flex gap-3 items-start">
            <ActiveStatusAvatar
              src={profile?.avatar_url}
              name={profile?.full_name || commentUsername}
              size={36}
              online={onlineUserIds.has(c.user_id || "")}
            />
            <div>
              <span className="text-white/40 text-[10px] font-bold uppercase">{commentUsername}</span>
              <p className="text-white/90 text-sm leading-relaxed">{c.content}</p>
            </div>
          </div>
          );
        })}
      </div>
      <div className="p-4 flex gap-2 bg-black/20 pb-safe">
        <input value={text} onChange={e => setText(e.target.value)}
          className="flex-1 bg-white/10 rounded-full px-5 py-3 text-white outline-none border border-white/5 focus:border-cyan-500/50"
          placeholder="Add a comment..." onKeyDown={e => e.key === "Enter" && handleSend()} />
        <button onClick={handleSend} disabled={sending || !text.trim()}
          className="bg-cyan-500 w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-50">
          {sending ? <Loader2 className="animate-spin text-white" size={18} /> : <Send size={18} className="text-white" />}
        </button>
      </div>
    </motion.div>
  );
};

// ── FlickCard ─────────────────────────────────────────────────────────────────
const FlickCard = memo(({ post, isActive, isPreloaded, currentUserId, onBridgeChat, isAdmin, onPostDeleted, onUserBanned, onVideoInvalid }: any) => {
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
  const [editingCaption,    setEditingCaption]     = useState(false);
  const [localContent,      setLocalContent]       = useState(post?.content || "");
  // ── Video health states ────────────────────────────────────────────────
  const [videoError,        setVideoError]         = useState<string | null>(null);
  const [sharePopupData, setSharePopupData] = useState<{
    post: SharePostData;
    anchor: ShareAnchor;
  } | null>(null);
  const sounds = useSoundEffects();
  const { openProfile } = useProfileViewer();
  const onlineUserIds = useOnlineUsers();
  const reelSettings = useMemo(() => getReelSettings(post), [post]);
  const videoUrl = reelSettings.videoUrl || post.media_url || post.url;
  const hasBackgroundAudio = Boolean(reelSettings.audioUrl);
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
    setLocalContent(post?.content || "");
  }, [post?.id, post?.liked_by_me, post?.likes_count, post?.comments_count, post?.shares_count, post?.content]);

  useEffect(() => () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
  }, []);

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
    vid.muted = hasBackgroundAudio;
    vid.volume = hasBackgroundAudio ? 0 : 1;
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
    if (hasBackgroundAudio && audio) {
      audio.currentTime = getReelAudioTargetTime(vid, audio);
    }

    const retryActivePlayback = () => {
      if (document.visibilityState === "hidden") return;
      const activeVideo = videoRef.current;
      if (!activeVideo || !activeVideo.isConnected) return;
      activeVideo.muted = hasBackgroundAudio;
      activeVideo.volume = hasBackgroundAudio ? 0 : 1;
      if (activeVideo.paused) requestPlayback(activeVideo, hasBackgroundAudio);

      const activeAudio = audioRef.current;
      if (hasBackgroundAudio && activeAudio) {
        activeAudio.muted = false;
        activeAudio.volume = 1;
        if (activeAudio.paused) {
          activeAudio.currentTime = getReelAudioTargetTime(activeVideo, activeAudio);
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
    if (hasBackgroundAudio && audio) requestPlayback(audio);

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
    setSharePopupData({
      post: {
        id,
        title: post.meta_title || localContent.slice(0, 72) || "Watch this Flick!",
        content: `${localContent.slice(0, 180)}${localContent.trim() ? "\n\n" : ""}via Flicks India`,
        media_url: post.media_url || post.video_url,
        video_url: post.video_url || post.media_url,
        cover_url: post.thumb_url || post.cover_url,
        meta_image: post.thumb_url || post.cover_url,
        type: "reel",
        author: post.author,
        meta_title: post.meta_title,
        meta_description: post.meta_description,
        shares_count: liveShares,
      },
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
    if (!trimmed) return;
    const table = post._source === "flicks" ? "flicks" : "posts";
    const field = post._source === "flicks" ? "caption" : "content";
    await supabase.from(table).update({ [field]: trimmed }).eq("id", post._raw_id);
    setEditingCaption(false);
    toast.success("Post updated.");
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
        content: "Your report is under review. We'll notify you once a decision is made.", is_read: false,
      });
      toast.success("✅ Report submitted.");
      setReportOpen(false); setReportText("");
    } catch { toast.error("Could not submit report"); }
    finally { setReporting(false); }
  };

  const deletePostRow = async (): Promise<string> => {
    const postId = post?._raw_id;
    if (typeof postId !== "string" || !postId.trim()) {
      throw new Error("Could not determine the Reel database ID.");
    }

    const { data, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data || data.id !== postId) {
      throw new Error("The Reel was not deleted from the database.");
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

    setDeleting(true);
    try {
      const deletedId = await deletePostRow();
      toast.success("Deleted permanently.");
      onPostDeleted?.(deletedId);
    } catch (error: unknown) {
      console.error("[Flicks] admin reel delete failed:", error);
      toast.error(getDeleteErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const handleOwnerDelete = async () => {
    if (!isOwner || !currentUserId || !post._raw_id || deleting) return;
    setMenuOpen(false);
    if (!window.confirm("Delete this Reel permanently?")) return;

    setDeleting(true);
    try {
      // Supabase RLS remains the final authorization check. The UI owner
      // check only controls visibility of this action.
      const deletedId = await deletePostRow();

      toast.success("Reel deleted.");
      onPostDeleted?.(deletedId);
    } catch (error: unknown) {
      console.error("[Flicks] owner reel delete failed:", error);
      toast.error(getDeleteErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const handleAdminBan = async () => {
    setMenuOpen(false);
    if (!isAdmin || !post.author_id) return;
    const reason = window.prompt(`ADMIN: Ban @${post.author}?\nReason:`, "Violated community guidelines");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("profiles")
      .update({ account_status: "suspended", suspension_reason: reason.trim() })
      .eq("id", post.author_id);
    if (error) { toast.error("Could not ban"); return; }
    toast.success(`🚫 @${post.author} banned`);
    onUserBanned?.(post.author_id);
  };

  if (!post) return null;

  const tickerText = `♪  @${post.author || "user"}  —  ${localContent || "No caption"}`;
  // The Reel creator is `author_id` on posts, matching Fame Feed's owner
  // contract. Keep user_id as a fallback for older cached Reel objects.
  const reelOwnerId = post.author_id || post.user_id;
  const isOwner = Boolean(currentUserId && reelOwnerId === currentUserId);

  return (
    /* Root card — explicit height, no flex layout so absolute children are unambiguous */
    <div
      data-vibe={vibe.primary?.tag}
      data-vibe-mix={secondaryVibe?.tag}
      className={`relative w-full bg-black snap-start overflow-hidden ${
        vibe.primary
          ? `post-vibe-card${isActive ? " post-vibe-in-view" : ""}`
          : ""
      }`}
      style={{
        height: "100dvh",
        touchAction: "pan-y",
        ...(vibe.primary
          ? {
              "--vibe-accent": vibe.primary.glowColor,
              "--vibe-secondary": secondaryVibe?.glowColor ?? vibe.primary.secondaryColor,
            }
          : {}),
      } as React.CSSProperties}
    >

      {/* ── Video — absolute inset-0 so it is unambiguously at z=0 behind every overlay ── */}
      <video
        ref={videoRef}
        key={videoUrl}
        src={videoUrl}
        loop
        muted={hasBackgroundAudio}
        playsInline
        autoPlay={false}
        preload={isActive ? "auto" : isPreloaded ? "metadata" : "none"}
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          backgroundColor: "#000",
          filter: reelSettings.cssFilter,
          zIndex: 0,
          display: videoError ? "none" : undefined,
          touchAction: "pan-y",
        }}
        onLoadStart={() => setVideoError(null)}
        onError={e => {
          const vid = e.currentTarget;
          const msg = parseMediaError(vid.error);
          console.warn("[FlickCard] video error:", msg, vid.src);
          setVideoError(msg);
          if (
            vid.error?.code === MediaError.MEDIA_ERR_DECODE ||
            vid.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ) {
            onVideoInvalid?.(post.id);
          }
        }}
      />
      {vibeAudioUrl && (
        <VibeAudioToggle
          postId={vibePostId}
          audioUrl={vibeAudioUrl}
          vibeLabel={vibe.primary?.label}
          audioTitle={vibe.primary?.audioTitle}
          compact
          floating
        />
      )}
      {hasBackgroundAudio && (
        <audio
          ref={audioRef}
          src={isActive ? reelSettings.audioUrl || undefined : undefined}
          muted={false}
          preload={isActive ? "auto" : "none"}
          loop
        />
      )}

      {/* ── Tap overlay — z-10, full-screen, catches single/double tap ── */}
      {/* touchAction:"pan-y" lets the snap-scroll container receive vertical swipes  */}
      {/* while still delivering tap (click) events for mute-toggle and double-tap-like */}
      {/* Must sit below action bar (z-40) so buttons receive clicks first */}
      <div className="absolute inset-0 z-10" style={{ touchAction: "pan-y" }} onClick={handleVideoTap} />

      {/* ── Gradient vignette — purely decorative, no pointer events ── */}
      <div className="absolute inset-0 pointer-events-none z-20"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 35%, transparent 55%, rgba(0,0,0,0.78) 100%)" }} />

      {/* ── Video error fallback — z-[25], interactive (Retry button) ── */}
      {videoError && (
        <div className="absolute inset-0 z-[25] flex flex-col items-center justify-center gap-4 bg-[#090b14] px-8">
          {post.thumb_url && (
            <img src={post.thumb_url} alt=""
              className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm pointer-events-none" />
          )}
          <div className="relative flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <span style={{ fontSize: 32 }}>📵</span>
            </div>
            <p className="text-white/80 font-bold text-sm">{videoError}</p>
            <p className="text-white/35 text-[11px] leading-relaxed max-w-[220px]">
              This video couldn't be played. Try again or scroll to the next one.
            </p>
            <button
              className="mt-1 px-5 py-2 rounded-full text-[12px] font-black text-white border border-white/20 bg-white/10 backdrop-blur-md active:scale-95 transition-transform"
              onClick={e => {
                e.stopPropagation();
                setVideoError(null);
                const vid = videoRef.current;
                if (vid) { vid.load(); requestPlayback(vid, hasBackgroundAudio); }
              }}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Floating heart on double-tap — z-50, pointer-events-none ── */}
      <AnimatePresence>
        {heartPos && (
          <motion.div
            key="heart-burst"
            className="absolute z-50 pointer-events-none select-none"
            style={{ left: heartPos.x - 32, top: heartPos.y - 32 }}
            initial={{ opacity: 1, scale: 0.4 }}
            animate={{ opacity: 0, scale: 1.9, y: -72 }}
            exit={{}}
            transition={{ duration: 0.75, ease: "easeOut" }}
          >
            <span style={{ fontSize: 64, filter: "drop-shadow(0 0 12px #ff2d55)" }}>❤️</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3-dot menu (top-right, above action bar) ── */}
      <div className="absolute top-12 right-3 z-50" onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(v => !v)}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/12 flex items-center justify-center">
          <MoreVertical size={16} className="text-white/80" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -6 }} transition={{ duration: 0.12 }}
                className="absolute right-0 top-11 z-[70] w-52 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {isOwner && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      window.dispatchEvent(new CustomEvent("flicks:open-reel-studio", { detail: { reel: post } }));
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-cyan-300 hover:bg-white/5 text-sm font-bold border-b border-white/5"
                  >
                    <Pencil size={14} /> Edit Reel
                  </button>
                )}
                {isOwner && (
                  <button onClick={() => { setMenuOpen(false); setEditingCaption(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-blue-400 hover:bg-white/5 text-sm font-bold border-b border-white/5">
                    <Pencil size={14} /> Edit Post
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={handleOwnerDelete}
                    disabled={deleting}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-bold border-b border-white/5 disabled:cursor-wait disabled:opacity-60"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {deleting ? "Deleting Reel…" : "Delete Reel"}
                  </button>
                )}
                <button onClick={e => {
                  const popupH = 240;
                  const spaceBelow = window.innerHeight - e.clientY;
                  const top = spaceBelow >= popupH + 16 ? e.clientY + 8 : Math.max(8, e.clientY - popupH - 8);
                  setMenuOpen(false); setReportAnchor({ top, right: 16 }); setReportOpen(true);
                }} className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-400 hover:bg-white/5 text-sm font-bold border-b border-white/5">
                  <Flag size={14} /> Report Video
                </button>
                {isAdmin && (
                  <>
                    <button onClick={handleAdminDelete}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-bold border-b border-white/5">
                      <Trash2 size={14} /> Delete (Admin)
                    </button>
                    {post.author_id && post.author_id !== currentUserId && (
                      <button onClick={handleAdminBan}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 hover:bg-red-500/10 text-sm font-bold">
                        <Ban size={14} /> Ban User (Admin)
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ── COMPACT Right-side Action Bar ── */}
      {/* Sits at bottom:80 — above the cassette bar (bottom:60, ~40px tall) with breathing room */}
      <div className="absolute right-2.5 z-40 flex flex-col items-center gap-3"
        style={{ bottom: 110 }}>

        {/* Author avatar + follow */}
        <div className="relative mb-1">
          <button
            type="button"
            className="overflow-visible cursor-pointer shrink-0"
            onClick={e => { e.stopPropagation(); openProfile?.(post.author_id); }}>
            <ActiveStatusAvatar
              src={post.author_avatar}
              name={post.author}
              size={40}
              online={onlineUserIds.has(post.author_id || "")}
            />
          </button>
          {/* Follow '+' badge */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[18px] h-[18px] bg-cyan-500 rounded-full flex items-center justify-center border-[1.5px] border-black shadow-md">
            <Plus size={10} className="text-white" strokeWidth={3.5} />
          </div>
        </div>

        {/* Like */}
        <button
          onClick={e => { e.stopPropagation(); triggerLike(); }}
          className="flex flex-col items-center gap-0.5 z-50">
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.13)", boxShadow: likedByMe ? "0 0 10px rgba(255,45,85,0.55)" : "none" }}>
            <Heart size={18} fill={likedByMe ? "#ff2d55" : "none"} className={likedByMe ? "text-[#ff2d55]" : "text-white"} />
          </div>
          <span className="text-[9px] font-black text-white/90" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
            {formatCount(liveLikes)}
          </span>
        </button>

        {/* Comment */}
        <button
          onClick={e => { e.stopPropagation(); setShowComments(true); }}
          className="flex flex-col items-center gap-0.5 z-50">
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.13)" }}>
            <MessageCircle size={18} className="text-white" />
          </div>
          <span className="text-[9px] font-black text-white/90" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
            {formatCount(liveCommentsCount)}
          </span>
        </button>

        {/* Share */}
        <button onClick={handleShare} className="flex flex-col items-center gap-0.5 z-50">
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.13)" }}>
            <Share2 size={17} className="text-white" />
          </div>
          <span className="text-[9px] font-black text-white/90" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
            {formatCount(liveShares)}
          </span>
        </button>

        {/* Magnet */}
        <div className="z-50" onClick={e => e.stopPropagation()}>
          <MagnetButton postId={post._raw_id} postType="flick" postOwnerId={post.author_id}
            currentUserId={currentUserId} onBridgeChat={onBridgeChat} dark />
        </div>
      </div>

      {/* ── Bottom info: username + caption ── */}
      {/* right: 68 leaves room for the action bar (≈44px wide) + gutter */}
      <div
        className={`absolute left-3 z-40 ${editingCaption ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{ bottom: 108, right: 68 }}
        onClick={e => editingCaption && e.stopPropagation()}>
        <div className="flex items-center gap-1.5 mb-0.5 pointer-events-none">
          <h3 className="font-black text-white text-[14px]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}>@{post.author || "user"}</h3>
          <BadgeCheck size={13} className="text-cyan-400" />
        </div>
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
        {editingCaption ? (
          <div onClick={e => e.stopPropagation()}>
            <textarea
              className="w-full bg-black/60 backdrop-blur-md border border-white/30 rounded-xl px-3 py-2 text-sm text-white outline-none resize-none"
              rows={2} value={localContent} onChange={e => setLocalContent(e.target.value)} autoFocus />
            <div className="flex gap-2 mt-1.5">
              <button onClick={() => { setLocalContent(post.content || ""); setEditingCaption(false); }}
                className="flex-1 py-1.5 rounded-xl bg-white/15 text-white/80 text-[11px] font-bold">Cancel</button>
              <button onClick={saveCaption} className="flex-1 py-1.5 rounded-xl bg-blue-500 text-white text-[11px] font-bold">Save</button>
            </div>
          </div>
        ) : (
          <p className="text-[11.5px] text-white/80 line-clamp-2 leading-snug font-medium" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>{localContent}</p>
        )}
      </div>

      {/* ── Cassette + Ticker Bar — pushed to the very bottom edge (above nav) ── */}
      {/* pointer-events-none on wrapper: purely decorative, taps pass through to z-10 overlay */}
      {isActive && !editingCaption && (
        <div className="absolute left-0 right-0 z-40 flex items-center gap-2.5 px-3 py-1 pointer-events-none"
          style={{
            bottom: 60,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(16px)",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}>
           <AudioCassette spinning={isActive} />
          {/* Neon rule */}
          <div className="shrink-0 w-px h-4 rounded-full" style={{ background: "rgba(0,255,230,0.55)", boxShadow: "0 0 5px rgba(0,255,230,0.55)" }} />
          <Ticker text={tickerText} isActive={isActive} />
        </div>
      )}

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

      {/* ── Comments ── */}
      <AnimatePresence>
        {showComments && (
          <>
            <div className="fixed inset-0 z-[200] bg-black/40" onClick={() => setShowComments(false)} />
            <CommentDrawer post={post} currentUserId={currentUserId}
              onClose={() => setShowComments(false)}
              onCommentAdded={(count: number) => setLiveCommentsCount(count)} />
          </>
        )}
      </AnimatePresence>
      {sharePopupData && createPortal(
        <SharePopup
          post={sharePopupData.post}
          anchor={sharePopupData.anchor}
          onClose={() => setSharePopupData(null)}
          onShare={(_mode, sharedPost) => void completeShare(sharedPost)}
        />,
        document.body,
      )}
    </div>
  );
});

// ── Main FlicksApp ────────────────────────────────────────────────────────────
export default function FlicksApp({
  onBack,
  onBridgeChat,
  isAdmin: isAdminProp = false,
  currentUserEmail: currentUserEmailProp,
  currentUserId: currentUserIdProp,
}: any) {
  const dataCache    = useDataCache();
  const cachedFlicks = dataCache.cacheRef.current.flicksFeed;
  const [flicks,       setFlicks]       = useState<any[]>(() => cachedFlicks?.data ?? []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading,      setLoading]      = useState(() => !cachedFlicks?.data);
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
  const scrollRafRef = useRef<number>(0);

  // Inject CSS keyframes once on mount
  useEffect(() => { injectFlicksStyles(); }, []);

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
    const fetchData = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const viewerId = authData.user?.id ?? null;
        setCurrentUserId(viewerId);
        const loadPosts = (projection: string) =>
          supabase
            .from("posts")
            .select(projection)
            .in("type", ["video", "reel"])
            .order("created_at", { ascending: false })
            .limit(30);
        let postsResult = await loadPosts(FLICKS_POST_PROJECTION_WITH_AUDIO);
        if (isMissingAudioUrlColumn(postsResult.error)) {
          postsResult = await loadPosts(FLICKS_POST_PROJECTION);
        }
        if (postsResult.error) throw postsResult.error;
        const rows = postsResult.data || [];

        const supportedRows = rows.filter((row: any) =>
          isSupportedVideoUrl(row.media_url, row.metadata),
        );
        const postIds = supportedRows.map((row: any) => row.id).filter(Boolean);
        const likedIds = new Set<string>();
        const likeCounts = new Map<string, number>();
        if (postIds.length > 0) {
          const [likedResult, likeRowsResult] = await Promise.all([
            viewerId
              ? supabase.from("likes").select("post_id").eq("user_id", viewerId).in("post_id", postIds)
              : Promise.resolve({ data: [], error: null }),
            supabase.from("likes").select("post_id").in("post_id", postIds),
          ]);

          (likedResult.data || []).forEach((row: any) => likedIds.add(row.post_id));
          if (likeRowsResult.error) {
            console.warn("[Flicks] like count fetch failed; using posts.likes_count:", likeRowsResult.error.message);
          } else {
            (likeRowsResult.data || []).forEach((row: any) => {
              likeCounts.set(row.post_id, (likeCounts.get(row.post_id) || 0) + 1);
            });
          }
        }

        const normalized = supportedRows.map((p: any) => ({
          id: `post_${p.id}`,
          _raw_id: p.id,
          _source: "posts",
          // The posts table stores the creator as author_id. Normalize that
          // value to user_id for the Reel card ownership contract.
          user_id: p.author_id || p.user_id,
          author_id: p.author_id || p.user_id,
          author: p.author_profile?.full_name || p.author || "User",
          author_avatar: p.author_profile?.avatar_url || null,
          content: p.content || p.caption || "",
          media_url: getReelSettings(p).videoUrl || p.media_url,
          video_url: getReelSettings(p).videoUrl || p.media_url,
          audio_url: getReelSettings(p).audioUrl,
          filters: getReelSettings(p).filter,
          playback_rate: getReelSettings(p).playbackRate,
          metadata: p.metadata,
          thumb_url: p.cover_url || p.thumb_url || null,
          likes_count: Math.max(
            likeCounts.has(p.id) ? likeCounts.get(p.id)! : Number(p.likes_count) || 0,
            0,
          ),
          views_count: p.views_count || 0,
          comments_count: Math.max(Number(p.comments_count) || 0, 0),
          shares_count: Math.max(Number(p.shares_count) || 0, 0),
          liked_by_me: likedIds.has(p.id),
          meta_title: p.meta_title || null,
          meta_description: p.meta_description || null,
          created_at: p.created_at,
        }));

        setFlicks(normalized);
        dataCache.setCache("flicksFeed", { data: normalized, fetchedAt: Date.now() });
      } catch (err) { console.error("[FlicksApp] fetch error:", err); }
      finally { setLoading(false); }
    };

    setCurrentUserId(currentUserIdProp ?? null);
    setFetchedEmail(currentUserEmailProp ?? null);
    fetchData();
  }, [currentUserIdProp, currentUserEmailProp]);

  // RAF-throttled scroll → update active index
  const scrollTicking = useRef(false);
  const onScroll = useCallback(() => {
    if (scrollTicking.current) return;
    scrollTicking.current = true;
    scrollRafRef.current = requestAnimationFrame(() => {
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
    if (flicks.length === 0 || currentIndex < flicks.length) return;
    const nextIndex = flicks.length - 1;
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
  }, [currentIndex, flicks.length]);

  const handlePostDeleted = useCallback((rawId: string) => {
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
      const normalized = {
        ...created,
        id: `post_${created.id}`,
        _raw_id: created.id,
        _source: "posts",
        user_id: created.author_id,
        author_id: created.author_id,
        author: created.author || "User",
        content: created.content || "",
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
      {/* Back button — minimal, ghost style like TikTok/Instagram; no heavy border or background */}
      {onBack && (
        <button onClick={onBack}
          className="fixed top-12 left-3 z-[110] p-1.5 text-white/70 hover:text-white transition-opacity"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
          aria-label="Close Flicks">
          <X size={20} strokeWidth={2.5} />
        </button>
      )}
      <div ref={containerRef} onScroll={onScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ touchAction: "pan-y" }}>
        {flicks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/20 font-bold">NO VIDEOS FOUND.</div>
        ) : (
          flicks.map((f, i) => {
            // DOM virtualization: only mount ±2 from active index
            const isNear = Math.abs(i - currentIndex) <= 2;
            if (!isNear) {
              return <div key={f.id} className="w-full bg-black snap-start shrink-0" style={{ height: "100dvh" }} />;
            }
            return (
              <React.Fragment key={f.id}>
                <FlickCard
                  post={f}
                  isActive={i === currentIndex}
                  isPreloaded={Math.abs(i - currentIndex) <= 1}
                  currentUserId={currentUserId}
                  onBridgeChat={onBridgeChat}
                  isAdmin={isAdmin}
                  onPostDeleted={handlePostDeleted}
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
