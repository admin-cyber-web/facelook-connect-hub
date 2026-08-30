import React, { useState, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useDataCache } from "../context/DataCacheContext";
import { isAdminEmail } from "../lib/adminConfig";
import { useSoundEffects } from "../hooks/useSoundEffects";
import AdsterraAd from "./AdsterraAd";
import {
  Heart, MessageCircle, Share2, Plus, X, Send,
  BadgeCheck, Loader2, Flag, Trash2, Ban, Pencil, MoreVertical,
} from "lucide-react";
import { MagnetButton } from "./MagnetSystem";
import { toast } from "sonner";

// ── Module-level sound preference (persists across card remounts) ─────────────
let globalSoundEnabled = false;

// ── Utilities ─────────────────────────────────────────────────────────────────
const formatCount = (n: any): string => {
  const num = Number(n);
  if (!num || isNaN(num)) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (num >= 1_000)     return (num / 1_000).toFixed(num >= 10_000 ? 0 : 1).replace(".0", "") + "K";
  return String(num);
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
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const sounds = useSoundEffects();

  useEffect(() => {
    if (!post?._raw_id) return;
    supabase
      .from("comments")
      .select("*, profiles:author_id (username, avatar_url)")
      .eq("post_id", post._raw_id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setComments(data || []));
  }, [post]);

  const handleSend = async () => {
    if (!text.trim() || !currentUserId) { toast.error("Please login to comment"); return; }
    setSending(true);
    sounds?.playSwoosh?.();
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert([{ post_id: post._raw_id, content: text.trim(), author_id: currentUserId, author: "User" }])
        .select("*, profiles:author_id (username, avatar_url)")
        .single();
      if (error) throw error;
      if (data) { setComments(p => [...p, data]); setText(""); toast.success("Commented!"); onCommentAdded?.(); }
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
        {comments.map((c, i) => (
          <div key={c.id || i} className="flex gap-3 items-start">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
              {c.profiles?.avatar_url
                ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" alt="dp" decoding="async" />
                : <div className="w-full h-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white font-black">{c.profiles?.username?.[0] || "U"}</div>}
            </div>
            <div>
              <span className="text-white/40 text-[10px] font-bold uppercase">{c.profiles?.username || "User"}</span>
              <p className="text-white/90 text-sm leading-relaxed">{c.content}</p>
            </div>
          </div>
        ))}
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
const FlickCard = memo(({ post, isActive, currentUserId, onBridgeChat, isAdmin, onPostDeleted, onUserBanned }: any) => {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const tapTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap    = useRef<number>(0);

  const [isMuted,           setIsMuted]           = useState(!globalSoundEnabled);
  const [likedByMe,         setLikedByMe]         = useState(false);
  const [liveLikes,         setLiveLikes]          = useState(Number(post?.likes_count || 0));
  const [liveCommentsCount, setLiveCommentsCount]  = useState(Number(post?.comments_count || 0));
  const [heartPos,          setHeartPos]           = useState<{ x: number; y: number } | null>(null);
  const [showComments,      setShowComments]       = useState(false);
  const [menuOpen,          setMenuOpen]           = useState(false);
  const [reportOpen,        setReportOpen]         = useState(false);
  const [reportAnchor,      setReportAnchor]       = useState<{ top: number; right: number } | null>(null);
  const [reportText,        setReportText]         = useState("");
  const [reporting,         setReporting]          = useState(false);
  const [editingCaption,    setEditingCaption]     = useState(false);
  const [localContent,      setLocalContent]       = useState(post?.content || "");
  // ── Video health states ────────────────────────────────────────────────
  const [videoError,        setVideoError]         = useState<string | null>(null);
  const [videoLoading,      setVideoLoading]       = useState(true);
  const sounds = useSoundEffects();
  const { openProfile } = useProfileViewer();

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
    if (!vid) return;
    if (isActive) {
      // Reset transient error/loading on each activation (e.g. user scrolled away and back)
      setVideoError(null);
      setVideoLoading(true);
      vid.currentTime = 0;
      const wantSound = globalSoundEnabled;
      vid.muted  = !wantSound;
      vid.volume = 1;
      setIsMuted(!wantSound);
      vid.play().catch((err) => {
        // NotAllowedError = autoplay policy; retry muted — not a decode failure
        if (err?.name === "NotAllowedError" || err?.name === "AbortError") {
          vid.muted = true;
          setIsMuted(true);
          vid.play().catch(() => {});
        }
        // Other errors (NotSupportedError etc.) are handled by the onError handler below
      });
    } else {
      vid.pause();
    }
  }, [isActive]);

  // ── Core like logic (used by button + double-tap) ─────────────────────
  const triggerLike = async () => {
    if (!currentUserId) { toast.error("Please login to like"); return; }
    sounds?.playPop?.();
    const isLiking = !likedByMe;
    setLikedByMe(isLiking);
    setLiveLikes(prev => isLiking ? prev + 1 : Math.max(prev - 1, 0));
    const isFlick   = post._source === "flicks";
    const table     = isFlick ? "flicks"     : "posts";
    const likesTable = isFlick ? "flick_likes" : "likes";
    const fkCol     = isFlick ? "flick_id"   : "post_id";
    const newCount  = liveLikes + (isLiking ? 1 : -1);
    try {
      if (isLiking) {
        await supabase.from(likesTable).upsert({ [fkCol]: post._raw_id, user_id: currentUserId, ...(isFlick ? {} : { reaction_type: "like" }) });
        await supabase.from(table).update({ likes_count: newCount }).eq("id", post._raw_id);
      } else {
        await supabase.from(likesTable).delete().eq(fkCol, post._raw_id).eq("user_id", currentUserId);
        await supabase.from(table).update({ likes_count: Math.max(newCount, 0) }).eq("id", post._raw_id);
      }
    } catch (err) { console.error(err); }
  };

  // ── Toggle mute ────────────────────────────────────────────────────────
  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const goUnmuted = isMuted;
    globalSoundEnabled = goUnmuted;
    vid.muted  = !goUnmuted;
    vid.volume = 1;
    if (goUnmuted) vid.play().catch(() => {});
    setIsMuted(!goUnmuted);
  };

  // ── Tap handler: single = mute toggle, double = like ──────────────────
  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double-tap detected
      if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
      lastTap.current = 0;
      const rect = e.currentTarget.getBoundingClientRect();
      setHeartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (!likedByMe) triggerLike();
      setTimeout(() => setHeartPos(null), 900);
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(toggleMute, 280);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const mediaUrl = post.cover_url || post.media_url || post.video_url;
    const postUrl  = `${window.location.origin}/?post=${post._raw_id || post.id}`;
    const { universalShare } = await import("../lib/universalShare");
    const titleLine = post.meta_title || post.content?.slice(0, 72) || "Watch this Flick!";
    const bodyLine  = post.meta_description
      || (post.content && post.content.length > 72 ? post.content.slice(72, 220) : "")
      || "";
    const captionText = [titleLine, bodyLine].filter(Boolean).join("\n");
    const outcome = await universalShare({
      title: titleLine,
      text: captionText,
      url: postUrl, mediaUrl, type: "reel",
    });
    if (outcome === "copied") toast.success("Link copied!");
    if (["shared-with-file", "shared-url-only", "copied"].includes(outcome || "")) {
      const pid = post._raw_id || post.id;
      await supabase.from("posts").update({ shares_count: (post.shares_count || 0) + 1 }).eq("id", pid);
      if (post.author_id && currentUserId && post.author_id !== currentUserId) {
        const { data: me } = await supabase.from("profiles").select("full_name").eq("id", currentUserId).maybeSingle();
        await supabase.from("notifications").insert({
          notifier_id: post.author_id, actor_id: currentUserId, type: "share", entity_id: pid,
          content: JSON.stringify({ text: `${me?.full_name || "Someone"} ne tumhara Reel share kiya.`, thumbnail_url: mediaUrl || null }),
          is_read: false,
        });
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

  const handleAdminDelete = async () => {
    setMenuOpen(false);
    if (!isAdmin) return;
    if (!window.confirm("ADMIN: Delete this video permanently?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post._raw_id);
    if (error) { toast.error("Could not delete"); return; }
    toast.success("🗑️ Deleted");
    onPostDeleted?.(post._raw_id);
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

  return (
    /* Root card — explicit height, no flex layout so absolute children are unambiguous */
    <div className="relative w-full bg-black snap-start overflow-hidden" style={{ height: "100dvh" }}>

      {/* ── Video — absolute inset-0 so it is unambiguously at z=0 behind every overlay ── */}
      <video
        ref={videoRef}
        key={post.media_url || post.url}
        src={post.media_url || post.url}
        loop
        muted={isMuted}
        playsInline
        autoPlay={false}
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ backgroundColor: "#000", zIndex: 0, display: videoError ? "none" : undefined }}
        onLoadStart={() => { setVideoLoading(true); setVideoError(null); }}
        onCanPlay={() => setVideoLoading(false)}
        onPlaying={() => setVideoLoading(false)}
        onWaiting={() => { if (!videoError) setVideoLoading(true); }}
        onStalled={() => { if (!videoError) setVideoLoading(true); }}
        onError={e => {
          const vid = e.currentTarget;
          const msg = parseMediaError(vid.error);
          console.warn("[FlickCard] video error:", msg, vid.src);
          setVideoError(msg);
          setVideoLoading(false);
        }}
      />

      {/* ── Tap overlay — z-10, full-screen, catches single/double tap ── */}
      {/* touchAction:"pan-y" lets the snap-scroll container receive vertical swipes  */}
      {/* while still delivering tap (click) events for mute-toggle and double-tap-like */}
      {/* Must sit below action bar (z-40) so buttons receive clicks first */}
      <div className="absolute inset-0 z-10" style={{ touchAction: "pan-y" }} onClick={handleVideoTap} />

      {/* ── Gradient vignette — purely decorative, no pointer events ── */}
      <div className="absolute inset-0 pointer-events-none z-20"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 35%, transparent 55%, rgba(0,0,0,0.78) 100%)" }} />

      {/* ── Loading spinner (buffer / first-load) — z-[25], pointer-events-none ── */}
      {videoLoading && !videoError && isActive && (
        <div className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-[3px] border-white/10 border-t-cyan-400 animate-spin" />
        </div>
      )}

      {/* ── Video error fallback — z-[25], interactive (Retry button) ── */}
      {videoError && (
        <div className="absolute inset-0 z-[25] flex flex-col items-center justify-center gap-4 bg-[#090b14] px-8">
          {post.thumb_url && (
            <img src={post.thumb_url} alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm pointer-events-none" />
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
                setVideoLoading(true);
                const vid = videoRef.current;
                if (vid) { vid.load(); vid.play().catch(() => {}); }
              }}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── "Tap for Sound" pill — z-30, pointer-events-none (tap passes to z-10 overlay) ── */}
      {isMuted && isActive && !videoError && !videoLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none select-none">
          <div className="flex items-center gap-2 bg-black/55 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 shadow-xl">
            <span className="text-white text-base">🔇</span>
            <span className="text-white text-[11px] font-bold tracking-wide">Tap for Sound</span>
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
                {post.author_id === currentUserId && (
                  <button onClick={() => { setMenuOpen(false); setEditingCaption(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-blue-400 hover:bg-white/5 text-sm font-bold border-b border-white/5">
                    <Pencil size={14} /> Edit Post
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
          <div
            className="w-10 h-10 rounded-full overflow-hidden cursor-pointer shrink-0"
            style={{ border: "2px solid rgba(255,255,255,0.9)", boxShadow: "0 0 8px rgba(0,255,230,0.3)" }}
            onClick={e => { e.stopPropagation(); openProfile?.(post.author_id); }}>
            {post.author_avatar
              ? <img src={post.author_avatar} className="w-full h-full object-cover" alt="" decoding="async" />
              : <div className="w-full h-full bg-gradient-to-br from-cyan-600 to-indigo-700 flex items-center justify-center text-white font-black text-sm uppercase">
                  {post.author?.[0] || "V"}
                </div>
            }
          </div>
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
          <span className="text-[9px] font-black text-white/90" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>Share</span>
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
          <AudioCassette spinning={!isMuted} />
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
              onCommentAdded={() => setLiveCommentsCount(p => p + 1)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── Main FlicksApp ────────────────────────────────────────────────────────────
export default function FlicksApp({ onBack, onBridgeChat, isAdmin: isAdminProp = false, currentUserEmail: currentUserEmailProp }: any) {
  const dataCache    = useDataCache();
  const cachedFlicks = dataCache.cacheRef.current.flicksFeed;
  const [flicks,       setFlicks]       = useState<any[]>(() => cachedFlicks?.data ?? []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading,      setLoading]      = useState(() => !cachedFlicks?.data);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [fetchedEmail,  setFetchedEmail]  = useState<string | null>(null);
  const isAdmin = isAdminProp || isAdminEmail(currentUserEmailProp) || isAdminEmail(fetchedEmail);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inject CSS keyframes once on mount
  useEffect(() => { injectFlicksStyles(); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
      setFetchedEmail(data.user?.email ?? null);
    });

    const fetchData = async () => {
      try {
        // Single source of truth: posts table, type=video, with unambiguous FK hint
        const { data: postsData, error: postsErr } = await supabase
          .from("posts")
          .select("*, author:profiles!posts_author_id_fkey(avatar_url, full_name), comments(count)")
          .eq("type", "video")
          .order("created_at", { ascending: false })
          .limit(20);

        if (postsErr) throw postsErr;

        const normalized = (postsData || []).map((p: any) => ({
          id: `post_${p.id}`,
          _raw_id: p.id,
          _source: "posts",
          author_id: p.author_id || p.user_id,
          author: p.author?.full_name || p.username || p.author_name || "User",
          author_avatar: p.author?.avatar_url || null,
          content: p.content || p.caption || "",
          media_url: p.media_url || p.video_url,
          thumb_url: p.cover_url || p.thumb_url || null,
          likes_count: p.likes_count || 0,
          views_count: p.views_count || 0,
          comments_count: p.comments?.[0]?.count || 0,
          shares_count: p.shares_count || 0,
          meta_title: p.meta_title || null,
          meta_description: p.meta_description || null,
          created_at: p.created_at,
        }));

        setFlicks(normalized);
        dataCache.setCache("flicksFeed", { data: normalized, fetchedAt: Date.now() });
      } catch (err) { console.error("[FlicksApp] fetch error:", err); }
      finally { setLoading(false); }
    };

    if (flicks.length === 0) fetchData();
    else if (dataCache.isStale("flicksFeed")) fetchData();
  }, []);

  // RAF-throttled scroll → update active index
  const scrollTicking = useRef(false);
  const onScroll = () => {
    if (scrollTicking.current) return;
    scrollTicking.current = true;
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const idx = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        if (idx !== currentIndex) setCurrentIndex(idx);
      }
      scrollTicking.current = false;
    });
  };

  if (loading)
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-500" size={40} />
      </div>
    );

  return (
    <div className="fixed inset-0 bg-black z-[100]">
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
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
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
                  currentUserId={currentUserId}
                  onBridgeChat={onBridgeChat}
                  isAdmin={isAdmin}
                  onPostDeleted={(rawId: string) => setFlicks(prev => prev.filter(x => x._raw_id !== rawId))}
                  onUserBanned={(authorId: string) => setFlicks(prev => prev.filter(x => x.author_id !== authorId))}
                />
                {(i + 1) % 3 === 0 && (
                  <div className="w-full bg-black snap-start shrink-0 relative" style={{ height: "100dvh" }}>
                    <div className="absolute inset-0 flex items-center justify-center px-4"><AdsterraAd /></div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
