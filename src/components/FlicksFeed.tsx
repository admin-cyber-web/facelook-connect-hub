import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import {
  Heart, MessageCircle, Share2, Music, VolumeX,
  Plus, Check, Eye, MoreVertical, Trash2, EyeOff,
  Flag, X, Send, BadgeCheck, Loader2, Flame,
} from "lucide-react";

// ── Utilities ──────────────────────────────────────────────────────────────────

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(".0", "") + "K";
  return String(n);
};

// Deterministic 1-10 luck factor from post id
const getLuckFactor = (id: string): number => {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 10) + 1;
};

// Is this creator "verified" (luck >= 6)
const isVerified = (postId: string) => getLuckFactor(postId) >= 6;

// Seeded pseudo-random [0,1) that's stable within the same hour
const seededRnd = (postId: string, salt: number) => {
  const luck = getLuckFactor(postId + salt);
  const x = Math.sin(luck * 9301 + salt * 49297 + 233567) * 10000;
  return x - Math.floor(x);
};

// Compute bonus engagement based on post age + luck
const getBonusEngagement = (post: any): { likes: number; views: number; shares: number } => {
  const ageHrs = (Date.now() - new Date(post.created_at).getTime()) / 3_600_000;
  if (ageHrs < 1) return { likes: 0, views: 0, shares: 0 };

  const luck = getLuckFactor(post.id);
  const r = (salt: number) => seededRnd(post.id, salt);

  if (luck <= 4) {
    return {
      likes: Math.floor(50 + r(1) * 50),
      views: Math.floor(200 + r(2) * 300),
      shares: Math.floor(r(3) * 10),
    };
  }
  if (luck <= 8) {
    return {
      likes: Math.floor(100 + r(1) * 400),
      views: Math.floor(600 + r(2) * 1400),
      shares: Math.floor(10 + r(3) * 50),
    };
  }
  // Viral: luck 9-10 🔥
  return {
    likes: Math.floor(500 + r(1) * 4500),
    views: Math.floor(1000 + r(2) * 9000),
    shares: Math.floor(50 + r(3) * 450),
  };
};

// Human-pattern irregular tick: adds 0-7 at unpredictable intervals
const HUMAN_STEPS = [0, 0, 2, 0, 0, 5, 1, 0, 3, 0, 0, 7, 0, 2, 0, 0, 1, 4, 0, 0];

// ── Video Fallback ─────────────────────────────────────────────────────────────
const VideoFallback = ({ title }: { title?: string }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
    <div className="text-5xl mb-4">🎬</div>
    <p className="text-white/40 text-xs font-bold uppercase tracking-widest text-center px-8">
      {title || "Video unavailable"}
    </p>
  </div>
);

// ── Media Component ────────────────────────────────────────────────────────────
const FlickMedia = ({ post, videoRef, isMuted, isActive }: any) => {
  const [videoFailed, setVideoFailed] = useState(false);
  const url = post.media_url || "";
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

  if (isYouTube) {
    if (!isActive) return <div className="w-full h-full bg-black" />;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]*).*/);
    const videoId = match?.[2]?.length === 11 ? match[2] : null;
    if (!videoId) return <VideoFallback title={post.content} />;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1`;
    return (
      <div className="relative w-full h-full bg-black overflow-hidden pointer-events-none">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-[120%] -top-[10%] scale-[1.5]"
          allow="autoplay; encrypted-media"
          title="Flick"
        />
      </div>
    );
  }
  if (videoFailed || !url) return <VideoFallback title={post.content} />;
  return (
    <video
      ref={videoRef}
      src={url}
      className="w-full h-full object-cover"
      loop muted={isMuted} playsInline preload="metadata"
      onError={() => setVideoFailed(true)}
    />
  );
};

// ── Comment Drawer ─────────────────────────────────────────────────────────────
const CommentDrawer = ({
  post, currentUserId, onClose,
}: { post: any; currentUserId: string | null; onClose: () => void }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const { playSwoosh } = useSoundEffects();

  useEffect(() => {
    supabase
      .from("comments")
      .select("id, content, author_id, created_at")
      .eq("post_id", post.id)
      .order("created_at")
      .then(({ data }) => setComments(data || []));
  }, [post.id]);

  const send = async () => {
    if (!text.trim() || !currentUserId) return;
    setSending(true);
    playSwoosh();
    const { data } = await supabase.from("comments").insert([{
      post_id: post.id,
      content: text.trim(),
      author_id: currentUserId,
    }]).select().single();
    if (data) setComments(prev => [...prev, data]);
    setText("");
    setSending(false);
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-zinc-900/98 backdrop-blur-xl rounded-t-3xl z-[200] border-t border-white/10 shadow-2xl"
      style={{ maxHeight: "65vh", display: "flex", flexDirection: "column" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Handle + header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-blue-400" />
          <span className="text-white font-black text-base">{comments.length} Comments</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 text-white/60 hover:bg-white/20">
          <X size={18} />
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {comments.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">No comments yet. Be the first!</p>
        )}
        {comments.map((c: any, i: number) => (
          <div key={c.id || i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-black text-white shrink-0">
              {(c.author_id || "U")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white/80 text-[11px] font-black mb-0.5">User</p>
              <p className="text-white/70 text-sm leading-snug">{c.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10 flex gap-2 shrink-0 pb-safe">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder="Add a comment…"
          className="flex-1 bg-white/10 text-white placeholder:text-white/30 text-sm px-4 py-2.5 rounded-full outline-none border border-white/10 focus:border-blue-500/60"
        />
        <button
          onClick={send} disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform"
        >
          {sending ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white" />}
        </button>
      </div>
    </motion.div>
  );
};

// ── FlickCard ──────────────────────────────────────────────────────────────────
const FlickCard = memo(({
  post, isActive, currentUserId, onDelete, onHide, onReport,
}: {
  post: any;
  isActive: boolean;
  currentUserId: string | null;
  onDelete: (id: string) => void;
  onHide: (id: string) => void;
  onReport: (id: string) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [likedByMe, setLikedByMe] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const { openProfile } = useProfileViewer();
  const { playPop, playSwoosh } = useSoundEffects();

  // Base counts from DB + bonus
  const bonus = getBonusEngagement(post);
  const baseLikes = (post.likes_count || 0) + bonus.likes;
  const baseViews = (post.views_count || 0) + bonus.views;
  const baseShares = (post.shares_count || 0) + bonus.shares;

  // Live animated counts (human-pattern ticker)
  const [liveLikes, setLiveLikes] = useState(baseLikes);
  const [liveViews, setLiveViews] = useState(baseViews);
  const tickRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Run live ticker only when card is active and post is old enough (>= 1hr)
  const ageHrs = (Date.now() - new Date(post.created_at).getTime()) / 3_600_000;
  const isViral = getLuckFactor(post.id) >= 9;

  const scheduleTick = useCallback(() => {
    if (!isActive || ageHrs < 1) return;
    const delay = 800 + Math.random() * 2200;
    timerRef.current = setTimeout(() => {
      const step = HUMAN_STEPS[tickRef.current % HUMAN_STEPS.length];
      tickRef.current++;
      const viewStep = isViral ? step * 3 + Math.floor(Math.random() * 5) : step;
      if (step > 0) setLiveLikes(prev => prev + step);
      if (viewStep > 0) setLiveViews(prev => prev + viewStep);
      scheduleTick();
    }, delay);
  }, [isActive, ageHrs, isViral]);

  useEffect(() => {
    setLiveLikes(baseLikes);
    setLiveViews(baseViews);
  }, [baseLikes, baseViews]);

  useEffect(() => {
    if (isActive) scheduleTick();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isActive, scheduleTick]);

  // Video play/pause
  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {
        if (videoRef.current) { videoRef.current.muted = true; setIsMuted(true); videoRef.current.play(); }
      });
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    playPop();
    const newVal = !likedByMe;
    setLikedByMe(newVal);
    setLiveLikes(prev => prev + (newVal ? 1 : -1));
    try {
      if (newVal) {
        await supabase.from("likes").upsert(
          { post_id: post.id, user_id: currentUserId, reaction_type: "like" },
          { onConflict: "post_id,user_id" }
        );
        await supabase.from("posts").update({ likes_count: (post.likes_count || 0) + 1 }).eq("id", post.id);
      } else {
        await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
        await supabase.from("posts").update({ likes_count: Math.max((post.likes_count || 1) - 1, 0) }).eq("id", post.id);
      }
    } catch (_) {}
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    playSwoosh();
    try { await navigator.share({ url: window.location.href, title: post.content || "Check this Flick!" }); } catch (_) {}
    try {
      await supabase.from("posts").update({ shares_count: (post.shares_count || 0) + 1 }).eq("id", post.id);
    } catch (_) {}
  };

  const luck = getLuckFactor(post.id);
  const verified = isVerified(post.id);

  return (
    <div className="relative w-full h-[100dvh] bg-black snap-start flex items-center justify-center overflow-hidden shrink-0">
      <FlickMedia post={post} videoRef={videoRef} isMuted={isMuted} isActive={isActive} />

      {/* Tap-to-mute layer */}
      {!menuOpen && !showComments && (
        <div className="absolute inset-0 z-10" onClick={() => setIsMuted(!isMuted)} />
      )}

      {/* Menu backdrop */}
      {menuOpen && (
        <div className="absolute inset-0 z-40" onClick={() => setMenuOpen(false)} />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75 pointer-events-none z-20" />

      {/* Mute indicator */}
      <AnimatePresence>
        {isMuted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          >
            <div className="bg-black/40 p-5 rounded-full backdrop-blur-md border border-white/10">
              <VolumeX size={32} className="text-white/80" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Viral badge */}
      {luck >= 9 && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
          className="absolute top-14 left-4 z-50 flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1.5 rounded-full shadow-lg"
        >
          <Flame size={13} fill="white" className="text-white" />
          <span className="text-white text-[11px] font-black uppercase tracking-wide">Viral</span>
        </motion.div>
      )}

      {/* Three-dots menu */}
      <div className="absolute top-14 right-4 z-50">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 active:scale-90 transition-transform"
        >
          <MoreVertical size={20} className="text-white" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -8 }} transition={{ duration: 0.15 }}
              className="absolute right-0 top-12 z-50 w-44 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {post.author_id === currentUserId && (
                <button onClick={() => { setMenuOpen(false); onDelete(post.id); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-semibold border-b border-white/5">
                  <Trash2 size={16} /> Delete
                </button>
              )}
              <button onClick={() => { setMenuOpen(false); onHide(post.id); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-white/80 hover:bg-white/5 transition-colors text-sm font-semibold border-b border-white/5">
                <EyeOff size={16} /> Hide
              </button>
              <button onClick={() => { setMenuOpen(false); onReport(post.id); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-400 hover:bg-orange-500/10 transition-colors text-sm font-semibold">
                <Flag size={16} /> Report
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Sidebar Actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-40 text-white">
        {/* Avatar */}
        <div className="relative mb-1">
          <div
            className="w-12 h-12 rounded-full border-2 border-white bg-zinc-800 flex items-center justify-center font-bold text-lg overflow-hidden shadow-xl cursor-pointer"
            onClick={(e) => { e.stopPropagation(); if (post.author_id) openProfile(post.author_id); }}
          >
            {post.author ? post.author[0].toUpperCase() : "V"}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ff2d55] rounded-full p-0.5 border-2 border-black">
            <Plus size={14} fill="currentColor" strokeWidth={3} />
          </div>
        </div>

        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center" style={{ WebkitTapHighlightColor: "transparent" }}>
          <motion.div whileTap={{ scale: 1.4 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
            <Heart
              size={32}
              fill={likedByMe ? "#ff2d55" : "none"}
              className={`${likedByMe ? "text-[#ff2d55]" : "text-white"} transition-colors drop-shadow-lg`}
            />
          </motion.div>
          <span className="text-[11px] font-bold mt-1 drop-shadow-md">{formatCount(liveLikes)}</span>
        </button>

        {/* Comments */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
          className="flex flex-col items-center"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <motion.div whileTap={{ scale: 1.3 }} transition={{ type: "spring", stiffness: 500 }}>
            <MessageCircle size={32} className="text-white drop-shadow-lg" />
          </motion.div>
          <span className="text-[11px] font-bold mt-1">{(post.comments?.length || 0)}</span>
        </button>

        {/* Views */}
        <div className="flex flex-col items-center opacity-90">
          <Eye size={30} className="drop-shadow-lg" />
          <span className="text-[11px] font-bold mt-1">{formatCount(liveViews)}</span>
        </div>

        {/* Share */}
        <button onClick={handleShare} className="flex flex-col items-center" style={{ WebkitTapHighlightColor: "transparent" }}>
          <motion.div whileTap={{ scale: 1.3 }} transition={{ type: "spring", stiffness: 500 }}>
            <Share2 size={30} className="text-white drop-shadow-lg" />
          </motion.div>
          <span className="text-[11px] font-bold mt-1">{formatCount(baseShares)}</span>
        </button>

        {/* Spinning disc */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          className="w-11 h-11 rounded-full border-[8px] border-zinc-800 bg-zinc-700 flex items-center justify-center mt-2 shadow-2xl"
        >
          <Music size={16} className="text-white/60" />
        </motion.div>
      </div>

      {/* Bottom Content */}
      <div className="absolute bottom-8 left-4 right-16 text-white z-40 pointer-events-none">
        <div className="flex items-center gap-2 mb-1.5">
          <h3
            className="font-black text-base drop-shadow-lg cursor-pointer pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); if (post.author_id) openProfile(post.author_id); }}
          >
            @{post.author || "vibe_user"}
          </h3>
          {verified ? (
            <BadgeCheck size={18} className="text-blue-400 drop-shadow-md shrink-0" fill="rgba(59,130,246,0.2)" />
          ) : (
            <span className="bg-blue-500/80 p-0.5 rounded-full shadow-lg shrink-0">
              <Check size={10} strokeWidth={4} />
            </span>
          )}
        </div>
        <p className="text-sm opacity-90 mb-4 line-clamp-2 leading-snug drop-shadow-md">{post.content}</p>
        <div className="flex items-center gap-2 max-w-[200px] bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full w-fit border border-white/10">
          <Music size={12} className="animate-pulse shrink-0" />
          <div className="text-[10px] font-medium whitespace-nowrap overflow-hidden">
            <motion.div animate={{ x: [160, -160] }} transition={{ duration: 7, repeat: Infinity, ease: "linear" }}>
              Original Sound — {post.author || "User"} 🎵
            </motion.div>
          </div>
        </div>
      </div>

      {/* Comment Drawer */}
      <AnimatePresence>
        {showComments && (
          <>
            <div className="fixed inset-0 z-[190] bg-black/50" onClick={() => setShowComments(false)} />
            <CommentDrawer post={post} currentUserId={currentUserId} onClose={() => setShowComments(false)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── Main App ───────────────────────────────────────────────────────────────────
export default function FlicksApp({ onBack }: { onBack?: () => void }) {
  const [flicks, setFlicks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [reportModal, setReportModal] = useState<{ postId: string; reason: string } | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Primary query — author_id is the reliable FK column
        const { data, error } = await supabase
          .from("posts")
          .select("id, author_id, content, media_url, type, likes_count, created_at, metadata")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("[FlicksFeed] Primary fetch failed:", error.message, "| code:", error.code, "| details:", error.details);
          // Fallback: bare minimum columns guaranteed to exist
          const { data: d2, error: e2 } = await supabase
            .from("posts")
            .select("id, author_id, content, media_url, type, created_at")
            .order("created_at", { ascending: false })
            .limit(50);
          if (e2) {
            console.error("[FlicksFeed] Fallback fetch also failed:", e2.message, "| code:", e2.code);
          } else if (d2) {
            setFlicks(d2.filter((p: any) =>
              p.media_url?.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)/) ||
              p.media_url?.includes("youtube.com") ||
              p.media_url?.includes("youtu.be")
            ));
          }
        } else if (data) {
          setFlicks(data.filter((p: any) =>
            p.media_url?.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)/) ||
            p.media_url?.includes("youtube.com") ||
            p.media_url?.includes("youtu.be")
          ));
        }
      } catch (err) {
        console.error("[FlicksFeed] Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const newIndex = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
  };

  const handleDelete = async (postId: string) => {
    await supabase.from("posts").delete().eq("id", postId);
    setFlicks(prev => prev.filter(p => p.id !== postId));
  };

  const handleHide = (postId: string) => setHiddenIds(prev => new Set([...prev, postId]));

  const handleReportSubmit = async () => {
    if (!reportModal?.reason.trim()) return;
    setReportSubmitting(true);
    await supabase.from("reports").insert([{ post_id: reportModal.postId, reporter_id: currentUserId, reason: reportModal.reason.trim() }]);
    setReportSubmitting(false);
    setReportModal(null);
  };

  const visibleFlicks = flicks.filter(p => !hiddenIds.has(p.id));

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, -1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative w-48 h-28 bg-zinc-800 rounded-lg border-4 border-zinc-700 p-2 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        >
          <div className="flex justify-between items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full border-4 border-dashed border-zinc-600 animate-spin" />
            <div className="w-8 h-8 rounded-full border-4 border-dashed border-zinc-600 animate-spin" />
          </div>
          <div className="w-full h-8 bg-zinc-900 rounded flex items-center justify-center">
            <span className="text-[8px] text-zinc-500 font-black tracking-[0.3em] uppercase italic">Facelook Flicks</span>
          </div>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 text-white font-black italic text-xl tracking-tighter">
          POWERED BY <span className="text-blue-500">FACELOOK</span>
        </motion.p>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black flex justify-center overflow-hidden touch-none">
        {onBack && (
          <button
            onClick={onBack}
            className="fixed top-10 left-4 z-[110] flex items-center justify-center w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/10 active:scale-90 transition-transform"
          >
            <X size={18} className="text-white" />
          </button>
        )}

        <div className="fixed top-0 left-0 w-full z-[100] flex justify-center pt-8 pointer-events-none">
          <motion.div
            key={currentIndex}
            initial={{ scale: 3, opacity: 0, filter: "blur(20px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <h1 className="text-white font-black italic text-3xl tracking-tighter drop-shadow-2xl mix-blend-difference">
              FLI<span className="text-blue-500">CKS</span>
            </h1>
            <motion.h1
              animate={{ opacity: [0, 0.4, 0], x: [-2, 2, 0] }}
              transition={{ repeat: Infinity, duration: 0.1, repeatDelay: 3 }}
              className="absolute inset-0 text-red-500 font-black italic text-3xl tracking-tighter -z-10"
            >
              FLICKS
            </motion.h1>
          </motion.div>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="w-full max-w-[500px] h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar relative"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <AnimatePresence>
            {visibleFlicks.map((post, i) => (
              <motion.div key={post.id} layout exit={{ opacity: 0, x: 120, transition: { duration: 0.35 } }}>
                <FlickCard
                  post={post}
                  isActive={i === currentIndex}
                  currentUserId={currentUserId}
                  onDelete={handleDelete}
                  onHide={handleHide}
                  onReport={(id) => setReportModal({ postId: id, reason: "" })}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Scroll progress dots */}
          <div className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-50 pointer-events-none px-2">
            {visibleFlicks.slice(0, 15).map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  height: i === currentIndex ? 30 : 6,
                  backgroundColor: i === currentIndex ? "#3b82f6" : "rgba(255,255,255,0.1)",
                }}
                className="w-1 rounded-full transition-all duration-300"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {reportModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setReportModal(null)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-lg bg-zinc-900 rounded-t-3xl p-6 pb-10 border-t border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <Flag size={18} className="text-orange-400" /> Report Post
                </h3>
                <button onClick={() => setReportModal(null)} className="p-1.5 rounded-full bg-white/10 text-white/60">
                  <X size={18} />
                </button>
              </div>
              <p className="text-white/40 text-xs mb-4 uppercase tracking-widest font-bold">Why are you reporting this?</p>
              <div className="space-y-2 mb-6">
                {["Spam or misleading", "Inappropriate content", "Hate speech", "Harassment", "Other"].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setReportModal(prev => prev ? { ...prev, reason } : prev)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-semibold border transition-all ${
                      reportModal.reason === reason
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button
                onClick={handleReportSubmit}
                disabled={!reportModal.reason || reportSubmitting}
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black text-sm uppercase tracking-wider disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                {reportSubmitting ? "Submitting…" : "Submit Report"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
