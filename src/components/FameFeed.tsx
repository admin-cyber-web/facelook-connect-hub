import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Send,
  Heart,
  MessageCircle,
  Share2,
  MoreVertical,
  Loader2,
  Trash2,
  EyeOff,
  Flag,
  X,
  Volume2,
  VolumeX,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Inline video: full-width, unmuted-first autoplay ─────────────────────────
const FeedVideo = ({ src }: { src: string }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!ref.current) return;
        if (entry.isIntersecting) {
          ref.current.muted = false;
          ref.current.play().catch(() => {
            if (ref.current) {
              ref.current.muted = true;
              setMuted(true);
              ref.current.play().catch(() => {});
            }
          });
        } else {
          ref.current.pause();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    ref.current.muted = !ref.current.muted;
    setMuted(ref.current.muted);
  };

  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: "9/16", maxHeight: "85vh" }}>
      <video
        ref={ref}
        src={src}
        loop
        muted={muted}
        playsInline
        className="w-full h-full object-cover"
      />
      <button
        onClick={toggle}
        className="absolute bottom-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-full border border-white/15"
      >
        {muted
          ? <VolumeX size={16} className="text-red-400" />
          : <Volume2 size={16} className="text-blue-400" />}
      </button>
    </div>
  );
};

// ── YouTube embed ─────────────────────────────────────────────────────────────
const YouTubeEmbed = ({ url }: { url: string }) => {
  const m = url.match(/^.*(youtu.be\/|v\/|embed\/|watch\?v=|\/shorts\/)([^#&?]*).*/);
  const id = m?.[2]?.length === 11 ? m[2] : null;
  if (!id) return null;
  return (
    <div className="w-full bg-black" style={{ aspectRatio: "16/9" }}>
      <iframe
        src={`https://www.youtube.com/embed/${id}?controls=1&modestbranding=1`}
        className="w-full h-full"
        allow="accelerometer; autoplay; encrypted-media"
        title="Video"
      />
    </div>
  );
};

// ── Smart media renderer ──────────────────────────────────────────────────────
const PostMedia = ({ post }: { post: any }) => {
  const url = post.media_url;
  if (!url) return null;

  const isYT =
    post.metadata?.is_youtube ||
    url.includes("youtube.com") ||
    url.includes("youtu.be");
  if (isYT) return <YouTubeEmbed url={url} />;

  const isVid =
    post.type === "video" ||
    /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]) ||
    url.includes("rapidcdn.app");
  if (isVid) return <FeedVideo src={url} />;

  // Image — standard 4:3 or natural height, capped
  return (
    <div className="w-full bg-black">
      <img
        src={url}
        className="w-full object-cover"
        style={{ maxHeight: "70vh" }}
        alt=""
      />
    </div>
  );
};

// ── Post caption: 3-line clamp + See More toggle ─────────────────────────────
const CLAMP_THRESHOLD = 180; // chars before we show "See More"

const PostCaption = ({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > CLAMP_THRESHOLD;

  return (
    <div className="px-4 pb-3">
      <p
        className={`text-sm text-white/85 leading-relaxed whitespace-pre-wrap break-words ${
          !expanded && isLong ? "line-clamp-3" : ""
        }`}
      >
        {content}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-blue-400 text-xs font-black hover:text-blue-300 transition-colors"
        >
          {expanded ? "See Less ▲" : "See More ▼"}
        </button>
      )}
    </div>
  );
};

// ── Main Feed ─────────────────────────────────────────────────────────────────
interface FameFeedProps {
  onPostClick?: () => void;
  onImageSelect?: (file: File) => void;
  userProfile?: any;
}

const FameFeed = ({ onPostClick, onImageSelect, userProfile }: FameFeedProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [reportModal, setReportModal] = useState<{ postId: string; reason: string } | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select(`*, comments:comments(*)`)
      .order("created_at", { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
    const sub = supabase
      .channel("fame-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, fetchPosts)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleLike = async (post: any) => {
    if (likedIds.has(post.id)) return;
    setLikedIds((p) => new Set([...p, post.id]));
    await supabase.from("posts").update({ likes_count: (post.likes_count || 0) + 1 }).eq("id", post.id);
    fetchPosts();
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("comments").insert([{
      post_id: postId,
      content: commentText,
      author: user?.user_metadata?.full_name || "Vibe User",
    }]);
    setCommentText("");
    fetchPosts();
  };

  const handleDelete = async (postId: string) => {
    setOpenMenuId(null);
    await supabase.from("posts").delete().eq("id", postId);
    setPosts((p) => p.filter((x) => x.id !== postId));
  };

  const handleHide = (postId: string) => {
    setOpenMenuId(null);
    setHiddenIds((p) => new Set([...p, postId]));
  };

  const handleReportSubmit = async () => {
    if (!reportModal?.reason.trim()) return;
    setReportSubmitting(true);
    await supabase.from("reports").insert([{
      post_id: reportModal.postId,
      reporter_id: currentUserId,
      reason: reportModal.reason.trim(),
    }]);
    setReportSubmitting(false);
    setReportModal(null);
  };

  const visiblePosts = posts.filter((p) => !hiddenIds.has(p.id));

  return (
    <>
      {/* "What's on your mind" bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]"
      >
        {userProfile?.avatar_url ? (
          <img
            src={userProfile.avatar_url}
            className="w-10 h-10 rounded-full object-cover border-2 border-blue-500/30 cursor-pointer"
            onClick={onPostClick}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm border-2 border-blue-500/30 cursor-pointer"
            onClick={onPostClick}
          >
            {userProfile?.full_name?.[0] || "U"}
          </div>
        )}
        <div
          className="flex-1 bg-white/5 py-2.5 px-5 rounded-full text-white/40 text-sm font-semibold border border-white/5 cursor-pointer active:bg-white/10"
          onClick={onPostClick}
        >
          What's on your mind?
        </div>

        {/* Gallery icon — opens device photo picker directly */}
        <button
          className="p-2 active:scale-90 transition-transform shrink-0"
          onClick={() => galleryInputRef.current?.click()}
        >
          <ImageIcon size={22} className="text-blue-400" />
        </button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onImageSelect?.(f);
            onPostClick?.();
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Loading state ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="animate-spin text-blue-500 mb-3" size={30} />
          <p className="text-white/20 font-black uppercase tracking-widest text-[10px]">
            Loading Feed
          </p>
        </div>
      )}

      {/* ── Mixed post + video feed ───────────────────────────────────────────── */}
      <AnimatePresence>
        {visiblePosts.map((post) => {
          const isVideo =
            post.type === "video" ||
            post.metadata?.is_youtube ||
            (post.media_url && (
              /\.(mp4|webm|ogg|mov|m4v)/i.test(post.media_url.split("?")[0]) ||
              post.media_url.includes("youtube.com") ||
              post.media_url.includes("youtu.be") ||
              post.media_url.includes("rapidcdn.app")
            ));

          return (
            <motion.article
              key={post.id}
              layout
              exit={{ opacity: 0, x: 80, transition: { duration: 0.25 } }}
              className="w-full border-b border-white/[0.06]"
            >
              {/* ── Post header ── */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 border border-white/10">
                    {post.author?.[0]?.toUpperCase() || "V"}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm leading-none">
                      {post.author || "Vibe User"}
                    </p>
                    <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mt-0.5">
                      {isVideo ? "🎬 Reel" : "📷 Post"} · Verified Creator
                    </p>
                  </div>
                </div>

                {/* Three-dots */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <MoreVertical size={18} className="text-white/50" />
                  </button>

                  <AnimatePresence>
                    {openMenuId === post.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.88, y: -6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.88, y: -6 }}
                          transition={{ duration: 0.13 }}
                          className="absolute right-0 top-10 z-50 w-44 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {post.author_id === currentUserId && (
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-semibold border-b border-white/5"
                            >
                              <Trash2 size={15} /> Delete
                            </button>
                          )}
                          <button
                            onClick={() => handleHide(post.id)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-white/70 hover:bg-white/5 text-sm font-semibold border-b border-white/5"
                          >
                            <EyeOff size={15} /> Hide
                          </button>
                          <button
                            onClick={() => { setOpenMenuId(null); setReportModal({ postId: post.id, reason: "" }); }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-400 hover:bg-orange-500/10 text-sm font-semibold"
                          >
                            <Flag size={15} /> Report
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ── Caption above media ── */}
              {post.content && <PostCaption content={post.content} />}

              {/* ── Media (full width, height driven by content type) ── */}
              <PostMedia post={post} />

              {/* ── Action bar ── */}
              <div className="flex items-center gap-5 px-4 py-3">
                <button onClick={() => handleLike(post)} className="flex items-center gap-1.5 group">
                  <Heart
                    size={22}
                    className={likedIds.has(post.id) ? "fill-red-500 text-red-500" : "text-white/60 group-hover:text-red-400 transition-colors"}
                  />
                  <span className="text-xs font-bold text-white/50">{post.likes_count || 0}</span>
                </button>

                <button
                  onClick={() => setActiveComment(activeComment === post.id ? null : post.id)}
                  className="flex items-center gap-1.5 group"
                >
                  <MessageCircle size={22} className="text-white/60 group-hover:text-blue-400 transition-colors" />
                  <span className="text-xs font-bold text-white/50">{post.comments?.length || 0}</span>
                </button>

                <button
                  onClick={() => navigator.share?.({ url: window.location.href })}
                  className="flex items-center gap-1.5 group ml-auto"
                >
                  <Share2 size={20} className="text-white/60 group-hover:text-white transition-colors" />
                </button>
              </div>

              {/* ── Inline comments ── */}
              <AnimatePresence>
                {activeComment === post.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-white/5"
                  >
                    <div className="px-4 pt-3 pb-1 flex gap-2">
                      <input
                        type="text"
                        placeholder="Write a comment…"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                      />
                      <button onClick={() => handleAddComment(post.id)} className="bg-blue-600 text-white px-4 rounded-xl">
                        <Send size={16} />
                      </button>
                    </div>
                    <div className="px-4 py-2 space-y-2 max-h-48 overflow-y-auto">
                      {post.comments?.map((c: any) => (
                        <div key={c.id} className="flex gap-3 py-1">
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400 shrink-0">
                            {c.author?.[0]}
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-tight">
                              {c.author}
                            </span>
                            <p className="text-xs text-white/70 mt-0.5 leading-snug">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </AnimatePresence>

      {!loading && visiblePosts.length === 0 && (
        <div className="flex flex-col items-center py-20 text-white/20">
          <p className="font-black uppercase tracking-widest text-xs">No posts yet</p>
        </div>
      )}

      {/* ── Report modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {reportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setReportModal(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-lg bg-zinc-900 rounded-t-3xl p-6 pb-10 border-t border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <Flag size={18} className="text-orange-400" /> Report Post
                </h3>
                <button onClick={() => setReportModal(null)} className="p-1.5 rounded-full bg-white/10 text-white/60">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2 mb-5">
                {["Spam or misleading", "Inappropriate content", "Hate speech", "Harassment", "Other"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setReportModal((p) => p ? { ...p, reason: r } : p)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-semibold border transition-all ${
                      reportModal.reason === r
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                onClick={handleReportSubmit}
                disabled={!reportModal.reason || reportSubmitting}
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black text-sm uppercase tracking-wider disabled:opacity-40"
              >
                {reportSubmitting ? "Submitting…" : "Submit Report"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FameFeed;
