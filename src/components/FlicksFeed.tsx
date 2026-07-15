import React, { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useDataCache } from "../context/DataCacheContext";
import { isAdminEmail } from "../lib/adminConfig";
import { useSoundEffects } from "../hooks/useSoundEffects";
import AdsterraAd from "./AdsterraAd";
import {
  Heart,
  MessageCircle,
  Share2,
  Plus,
  Check,
  Eye,
  X,
  Send,
  BadgeCheck,
  Loader2,
  Flame,
  MoreVertical,
  Flag,
  Trash2,
  Ban,
  Pencil,
} from "lucide-react";
import { MagnetButton, CreatorVoice, useMagnet } from "./MagnetSystem";
// universalShare is imported dynamically in handleShare (lazy-loaded)
import { toast } from "sonner";

// -- Utilities --
const formatCount = (n: any): string => {
  const num = Number(n);
  if (!num || isNaN(num)) return "0";
  if (num >= 1_000_000)
    return (num / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (num >= 1_000)
    return (num / 1_000).toFixed(num >= 10_000 ? 0 : 1).replace(".0", "") + "K";
  return String(num);
};

// -- Comment Drawer (Updated for Profiles & Real-time Update) --
const CommentDrawer = ({
  post,
  currentUserId,
  onClose,
  onCommentAdded,
}: any) => {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const sounds = useSoundEffects();

  useEffect(() => {
    if (!post?._raw_id) return;
    const fetchComments = async () => {
      // Profiles join kiya taaki Name aur DP mile
      const { data, error } = await supabase
        .from("comments")
        .select(
          `
          *,
          profiles:author_id (username, avatar_url)
        `,
        )
        .eq("post_id", post._raw_id)
        .order("created_at", { ascending: true });
      if (!error) setComments(data || []);
    };
    fetchComments();
  }, [post]);

  const handleSend = async () => {
    if (!text.trim() || !currentUserId) {
      toast.error("Please login to comment");
      return;
    }
    setSending(true);
    sounds?.playSwoosh?.();

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert([
          {
            post_id: post._raw_id,
            content: text.trim(),
            author_id: currentUserId,
            author: "User",
          },
        ])
        .select(`*, profiles:author_id (username, avatar_url)`)
        .single();

      if (error) throw error;
      if (data) {
        setComments((prev) => [...prev, data]);
        setText("");
        toast.success("Commented!");
        if (onCommentAdded) onCommentAdded(); // Count update karne ke liye
      }
    } catch (err: any) {
      toast.error("Comment send nahi hua");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl z-[205] h-[70vh] flex flex-col border-t border-white/10 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
        <span className="text-white font-bold text-lg">
          {comments.length} Comments
        </span>
        <button
          onClick={onClose}
          className="p-2 bg-white/5 rounded-full text-white/50"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {comments.length === 0 && (
          <p className="text-white/20 text-center py-10">
            Pehla comment aap karein!
          </p>
        )}
        {comments.map((c, i) => (
          <div key={c.id || i} className="flex gap-3 items-start">
            {/* DP/Avatar Logic */}
            <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
              {c.profiles?.avatar_url ? (
                <img
                  src={c.profiles.avatar_url}
                  className="w-full h-full object-cover"
                  alt="dp"
                 decoding="async"/>
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white font-black">
                  {c.profiles?.username?.[0] || "U"}
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-white/40 text-[10px] font-bold uppercase">
                {c.profiles?.username || "User"}
              </span>
              <p className="text-white/90 text-sm leading-relaxed">
                {c.content}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 flex gap-2 bg-black/20 pb-safe">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 bg-white/10 rounded-full px-5 py-3 text-white outline-none border border-white/5 focus:border-cyan-500/50"
          placeholder="Add a comment..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="bg-cyan-500 w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="animate-spin text-white" size={18} />
          ) : (
            <Send size={18} className="text-white" />
          )}
        </button>
      </div>
    </motion.div>
  );
};


// -- FlickCard --
const FlickCard = memo(
  ({ post, isActive, currentUserId, onBridgeChat, isAdmin, onPostDeleted, onUserBanned }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [likedByMe, setLikedByMe] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [liveLikes, setLiveLikes] = useState(Number(post?.likes_count || 0));
    const [liveCommentsCount, setLiveCommentsCount] = useState(
      Number(post?.comments_count || 0),
    );
    const [menuOpen, setMenuOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportAnchor, setReportAnchor] = useState<{ top: number; right: number } | null>(null);
    const [reportText, setReportText] = useState("");
    const [reporting, setReporting] = useState(false);
    const [editingCaption, setEditingCaption] = useState(false);
    const [localContent, setLocalContent] = useState(post?.content || "");
    const sounds = useSoundEffects();
    const { openProfile } = useProfileViewer();

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
      if (!currentUserId) { toast.error("Please login to report"); return; }
      if (!reportText.trim()) return;
      setReporting(true);
      try {
        const { data: reportData } = await supabase.from("reports").insert({
          reporter_id: currentUserId,
          reported_user_id: post.author_id,
          post_id: post._raw_id,
          reason: reportText.trim(),
          status: "pending",
        }).select("id").single();
        await supabase.from("notifications").insert({
          notifier_id: currentUserId,
          actor_id: currentUserId,
          type: "report_submitted",
          entity_id: reportData?.id ?? post._raw_id,
          content: `Your report is under review. We'll notify you once a decision is made.`,
          is_read: false,
        });
        toast.success("✅ Report submitted. We'll review it shortly.");
        setReportOpen(false); setReportText("");
      } catch {
        toast.error("Could not submit report");
      } finally { setReporting(false); }
    };

    const handleAdminDelete = async () => {
      setMenuOpen(false);
      if (!isAdmin) return;
      if (!window.confirm("ADMIN: Delete this video permanently?")) return;
      const { error } = await supabase.from("posts").delete().eq("id", post._raw_id);
      if (error) { toast.error("Could not delete"); return; }
      toast.success("🗑️ Video deleted by admin");
      onPostDeleted?.(post._raw_id);
    };

    const handleAdminBan = async () => {
      setMenuOpen(false);
      if (!isAdmin || !post.author_id) return;
      const reason = window.prompt(`ADMIN: Ban @${post.author}?\nEnter reason:`, "Violated community guidelines");
      if (!reason || !reason.trim()) return;
      const { error } = await supabase.from("profiles")
        .update({ account_status: "suspended", suspension_reason: reason.trim() })
        .eq("id", post.author_id);
      if (error) { toast.error("Could not ban user"); return; }
      toast.success(`🚫 @${post.author} banned`);
      onUserBanned?.(post.author_id);
    };

    // Play/pause native video when card scrolls in/out of view
    useEffect(() => {
      const vid = videoRef.current;
      if (!vid) return;
      if (isActive) {
        vid.currentTime = 0;
        vid.muted = true;
        setIsMuted(true);
        vid.volume = 1;
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    }, [isActive]);

    const handleLike = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentUserId) return toast.error("Please login to like");
      sounds?.playPop?.();
      const isLiking = !likedByMe;
      setLikedByMe(isLiking);
      setLiveLikes((prev) => (isLiking ? prev + 1 : prev - 1));

      const isFlick = post._source === "flicks";
      const tableName = isFlick ? "flicks" : "posts";
      const likesTable = isFlick ? "flick_likes" : "likes";
      const fkColumn   = isFlick ? "flick_id" : "post_id";
      try {
        if (isLiking) {
          await supabase
            .from(likesTable)
            .upsert({
              [fkColumn]: post._raw_id,
              user_id: currentUserId,
              ...(isFlick ? {} : { reaction_type: "like" }),
            });
          await supabase
            .from(tableName)
            .update({ likes_count: liveLikes + 1 })
            .eq("id", post._raw_id);
        } else {
          await supabase
            .from(likesTable)
            .delete()
            .eq(fkColumn, post._raw_id)
            .eq("user_id", currentUserId);
          await supabase
            .from(tableName)
            .update({ likes_count: Math.max(liveLikes - 1, 0) })
            .eq("id", post._raw_id);
        }
      } catch (err) {
        console.error(err);
      }
    };

    const handleShare = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const mediaUrl = post.cover_url || post.media_url || post.video_url;
      const postUrl  = `${window.location.origin}/?post=${post._raw_id || post.id}`;
      const { universalShare } = await import("../lib/universalShare");
      const outcome = await universalShare({
        title: post.meta_title || post.content?.slice(0, 60) || "Watch this Flick!",
        text: post.content || "",
        url: postUrl,
        mediaUrl,
        type: "reel",
      });
      if (outcome === "copied") toast.success("Link copied!");
      if (outcome === "shared-with-file" || outcome === "shared-url-only" || outcome === "copied") {
        const postRawId = post._raw_id || post.id;
        await supabase.from("posts").update({ shares_count: (post.shares_count || 0) + 1 }).eq("id", postRawId);
        // Notify the reel author when someone else shares their reel
        if (post.author_id && currentUserId && post.author_id !== currentUserId) {
          const { data: me } = await supabase.from("profiles").select("full_name").eq("id", currentUserId).maybeSingle();
          const myName = me?.full_name || "Someone";
          await supabase.from("notifications").insert({
            notifier_id: post.author_id,
            actor_id: currentUserId,
            type: "share",
            entity_id: postRawId,
            content: JSON.stringify({
              text: `${myName} ne tumhara Reel share kiya.`,
              thumbnail_url: mediaUrl || null,
              share_title: post.meta_title || post.content?.slice(0, 60) || "Reel",
              share_description: post.content?.slice(0, 100) || "",
            }),
            is_read: false,
          });
        }
      }
    };

    if (!post) return null;

    return (
      <div className="relative w-full h-[100dvh] bg-black snap-start flex items-center justify-center overflow-hidden">

        {/* ── Native HTML5 video — direct MP4 only, zero iframe ── */}
        <video
          ref={videoRef}
          src={post.media_url || post.url}
          loop
          muted={isMuted}
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
          style={{ backgroundColor: "black" }}
        />

        {/* Tap-anywhere overlay — toggles mute/unmute */}
        <div
          className="absolute inset-0 z-10"
          onClick={() => {
            const vid = videoRef.current;
            if (!vid) return;
            const goUnmuted = isMuted;
            vid.muted = !goUnmuted;
            vid.volume = 1;
            if (goUnmuted) vid.play().catch(() => {});
            setIsMuted(!goUnmuted);
          }}
        />

        {/* Tap-for-Sound pill — shown while muted and card is active */}
        {isMuted && isActive && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 shadow-xl">
              <span className="text-white text-lg">🔇</span>
              <span className="text-white text-xs font-bold tracking-wide">Tap for Sound</span>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70 pointer-events-none z-20" />

        {/* Actions */}
        <div className="absolute right-4 bottom-28 flex flex-col items-center gap-7 z-40">
          <div className="relative mb-2">
            <div
              className="w-12 h-12 rounded-full border-2 border-white overflow-hidden shadow-lg cursor-pointer"
              onClick={() => openProfile?.(post.author_id)}
            >
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white font-bold text-xl uppercase">
                {post.author?.[0] || "V"}
              </div>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-cyan-500 rounded-full p-0.5 border-2 border-black">
              <Plus size={14} className="text-white" />
            </div>
          </div>

          <button
            onClick={handleLike}
            className="flex flex-col items-center text-white"
          >
            <Heart
              size={36}
              fill={likedByMe ? "#ff2d55" : "none"}
              className={likedByMe ? "text-[#ff2d55] scale-110" : "text-white"}
            />
            <span className="text-[11px] font-black mt-1">
              {formatCount(liveLikes)}
            </span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center text-white"
          >
            <MessageCircle size={36} />
            <span className="text-[11px] font-black mt-1">
              {formatCount(liveCommentsCount)}
            </span>
          </button>

          <button
            onClick={handleShare}
            className="flex flex-col items-center text-white"
          >
            <Share2 size={34} />
            <span className="text-[11px] font-black mt-1">Share</span>
          </button>

          <div className="mt-2">
            <MagnetButton
              postId={post._raw_id}
              postType="flick"
              postOwnerId={post.author_id}
              currentUserId={currentUserId}
              onBridgeChat={onBridgeChat}
              dark
            />
          </div>
        </div>

        <div
          className={`absolute bottom-12 left-4 right-20 text-white z-40 ${editingCaption ? "pointer-events-auto" : "pointer-events-none"}`}
          onClick={e => editingCaption && e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-2 pointer-events-none">
            <h3 className="font-black text-lg">@{post.author || "user"}</h3>
            <BadgeCheck size={18} className="text-cyan-400" />
          </div>
          {editingCaption ? (
            <div onClick={e => e.stopPropagation()}>
              <textarea
                className="w-full bg-black/60 backdrop-blur-md border border-white/30 rounded-xl px-3 py-2 text-sm text-white outline-none resize-none"
                rows={2}
                value={localContent}
                onChange={e => setLocalContent(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => { setLocalContent(post.content || ""); setEditingCaption(false); }}
                  className="flex-1 py-1.5 rounded-xl bg-white/15 text-white/80 text-[11px] font-bold">
                  Cancel
                </button>
                <button
                  onClick={saveCaption}
                  className="flex-1 py-1.5 rounded-xl bg-blue-500 text-white text-[11px] font-bold">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm opacity-90 line-clamp-2 leading-snug">{localContent}</p>
          )}
        </div>

        {/* 3-dots menu (top-right) */}
        <div className="absolute top-12 right-4 z-50" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center"
          >
            <MoreVertical size={18} className="text-white" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-12 z-[70] w-52 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                >
                  {post.author_id === currentUserId && (
                    <button
                      onClick={() => { setMenuOpen(false); setEditingCaption(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-blue-400 hover:bg-white/5 text-sm font-bold border-b border-white/5"
                    >
                      <Pencil size={15} /> Edit Post
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      const popupH = 240;
                      const spaceBelow = window.innerHeight - e.clientY;
                      const top = spaceBelow >= popupH + 16
                        ? e.clientY + 8
                        : Math.max(8, e.clientY - popupH - 8);
                      setMenuOpen(false);
                      setReportAnchor({ top, right: 16 });
                      setReportOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-400 hover:bg-white/5 text-sm font-bold border-b border-white/5"
                  >
                    <Flag size={15} /> Report Video
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={handleAdminDelete}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-bold border-b border-white/5"
                      >
                        <Trash2 size={15} /> Delete Video (Admin)
                      </button>
                      {post.author_id && post.author_id !== currentUserId && (
                        <button
                          onClick={handleAdminBan}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 hover:bg-red-500/10 text-sm font-bold"
                        >
                          <Ban size={15} /> Ban User (Admin)
                        </button>
                      )}
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Report Modal */}
        <AnimatePresence>
          {reportOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm"
                onClick={() => setReportOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                style={{
                  position: "fixed",
                  top: reportAnchor?.top ?? 120,
                  right: reportAnchor?.right ?? 16,
                  zIndex: 220,
                }}
                className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                      <Flag size={15} className="text-orange-500" />
                    </div>
                    <span className="text-gray-900 font-black text-sm">Report Video</span>
                  </div>
                  <button onClick={() => setReportOpen(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <p className="text-gray-500 text-xs mb-3">Help us keep Flicks India safe.</p>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Describe the issue (spam, harassment, inappropriate content…)"
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-orange-400 resize-none"
                />
                <button
                  onClick={handleReport}
                  disabled={reporting || !reportText.trim()}
                  className="w-full mt-3 py-3 rounded-2xl font-black text-white text-sm disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}
                >
                  {reporting ? "Submitting…" : "Submit Report"}
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showComments && (
            <>
              <div
                className="fixed inset-0 z-[200] bg-black/40"
                onClick={() => setShowComments(false)}
              />
              <CommentDrawer
                post={post}
                currentUserId={currentUserId}
                onClose={() => setShowComments(false)}
                onCommentAdded={() => setLiveCommentsCount((prev) => prev + 1)}
              />
            </>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

// -- Main App --
export default function FlicksApp({ onBack, onBridgeChat, isAdmin: isAdminProp = false, currentUserEmail: currentUserEmailProp }: any) {
  const dataCache = useDataCache();
  const cachedFlicks = dataCache.cacheRef.current.flicksFeed;
  const [flicks, setFlicks] = useState<any[]>(() => cachedFlicks?.data ?? []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(() => !cachedFlicks?.data);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [fetchedEmail, setFetchedEmail] = useState<string | null>(null);
  // Robust admin detection: trust prop OR fall back to fetched email
  const isAdmin = isAdminProp || isAdminEmail(currentUserEmailProp) || isAdminEmail(fetchedEmail);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setCurrentUserId(data.user?.id ?? null);
        setFetchedEmail(data.user?.email ?? null);
      });

    const fetchData = async () => {
      try {
        // 1) Flicks table — new schema with author profile join
        const { data: flicksData, error: flicksErr } = await supabase
          .from("flicks")
          .select("*, author:profiles(avatar_url, full_name), comments(count)")
          .order("created_at", { ascending: false })
          .limit(15);

        const flicksNormalized = (!flicksErr && flicksData ? flicksData : []).map((f: any) => ({
          id: `flick_${f.id}`,
          _raw_id: f.id,
          _source: "flicks",
          author_id: f.author_id || f.user_id,
          author: f.author?.full_name || f.username || "User",
          author_avatar: f.author?.avatar_url || null,
          content: f.caption || f.content || "",
          media_url: f.video_url || f.media_url,
          thumb_url: f.thumb_url || null,
          likes_count: f.likes_count || 0,
          views_count: f.views_count || 0,
          comments_count: f.comments?.[0]?.count || 0,
          created_at: f.created_at,
        }));

        // 2) Posts table — legacy video posts
        const { data: postsData, error: postsErr } = await supabase
          .from("posts")
          .select("*, comments(count)")
          .eq("type", "video")
          .order("created_at", { ascending: false })
          .limit(15);
        if (postsErr && flicksErr) throw postsErr;

        const postsNormalized = (postsData || []).map((p) => ({
          id: `post_${p.id}`,
          _raw_id: p.id,
          _source: "posts",
          author_id: p.author_id || p.user_id,
          author: p.username || p.author || "User",
          content: p.caption || p.content || "",
          media_url: p.video_url || p.media_url,
          likes_count: p.likes_count || 0,
          views_count: p.views_count || 0,
          comments_count: p.comments?.[0]?.count || 0,
          created_at: p.created_at,
        }));

        // Merge — flicks table content first, then legacy posts; sort by date
        const merged = [...flicksNormalized, ...postsNormalized].sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        setFlicks(merged);
        dataCache.setCache("flicksFeed", { data: merged, fetchedAt: Date.now() });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    // Cache-aware mount: restore from cache instantly, refetch silently if stale (>2min).
    if (flicks.length === 0) fetchData();
    else if (dataCache.isStale("flicksFeed")) fetchData();
  }, []);

  // RAF-throttled scroll handler — fires at most once per animation frame (16ms)
  // instead of every pixel, cutting scroll-induced JS work by ~10×
  const scrollTicking = useRef(false);
  const onScroll = () => {
    if (scrollTicking.current) return;
    scrollTicking.current = true;
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const idx = Math.round(
          containerRef.current.scrollTop / containerRef.current.clientHeight,
        );
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
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-12 left-4 z-[110] p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white shadow-xl"
        >
          <X size={24} />
        </button>
      )}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      >
        {flicks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/20 font-bold">
            NO VIDEOS FOUND.
          </div>
        ) : (
          flicks.map((f, i) => {
            // ── DOM Virtualization ────────────────────────────────────────────
            // Only mount the full FlickCard for current card ± 2.
            // Cards outside that window are replaced with a lightweight black
            // snap-start placeholder — eliminates 40+ idle <video> elements
            // from the DOM, cutting GPU memory and compositor layers drastically.
            const isNear = Math.abs(i - currentIndex) <= 2;
            if (!isNear) {
              return (
                <div
                  key={f.id}
                  className="w-full bg-black snap-start shrink-0"
                  style={{ height: "100dvh" }}
                />
              );
            }
            return (
              <>
                <FlickCard
                  key={f.id}
                  post={f}
                  isActive={i === currentIndex}
                  currentUserId={currentUserId}
                  onBridgeChat={onBridgeChat}
                  isAdmin={isAdmin}
                  onPostDeleted={(rawId: string) =>
                    setFlicks(prev => prev.filter(x => x._raw_id !== rawId))
                  }
                  onUserBanned={(authorId: string) =>
                    setFlicks(prev => prev.filter(x => x.author_id !== authorId))
                  }
                />
                {(i + 1) % 3 === 0 && (
                  <div className="w-full bg-black snap-start shrink-0 relative" style={{ height: "100dvh" }}>
                    <div className="absolute inset-0 flex items-center justify-center px-4">
                      <AdsterraAd />
                    </div>
                  </div>
                )}
              </>
            );
          })
        )}
      </div>
    </div>
  );
}
