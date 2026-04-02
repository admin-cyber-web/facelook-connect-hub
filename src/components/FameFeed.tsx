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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Inline Video (fits inside feed, autoplay on scroll) ──────────────────────
const FeedVideo = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!videoRef.current) return;
        if (entry.isIntersecting) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      },
      { threshold: 0.5 },
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [src]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  return (
    <div className="relative w-full aspect-video bg-black">
      <video
        ref={videoRef}
        src={src}
        loop
        muted={isMuted}
        playsInline
        className="w-full h-full object-cover"
      />
      <button
        onClick={toggle}
        className="absolute bottom-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-full border border-white/10"
      >
        {isMuted ? (
          <VolumeX size={16} className="text-white" />
        ) : (
          <Volume2 size={16} className="text-blue-400" />
        )}
      </button>
    </div>
  );
};

// ── YouTube embed ─────────────────────────────────────────────────────────────
const YouTubeEmbed = ({ url }: { url: string }) => {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[2].length === 11 ? match[2] : null;
  if (!videoId) return null;
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&modestbranding=1`;
  return (
    <div className="w-full aspect-video bg-black">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; encrypted-media; gyroscope"
        title="Video"
      />
    </div>
  );
};

// ── Smart media picker ────────────────────────────────────────────────────────
const PostMedia = ({ post }: { post: any }) => {
  const url = post.media_url;
  if (!url) return null;

  const isYouTube =
    post.metadata?.is_youtube ||
    url.includes("youtube.com") ||
    url.includes("youtu.be");
  if (isYouTube) return <YouTubeEmbed url={url} />;

  const isVideo =
    post.type === "video" ||
    /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]) ||
    url.includes("rapidcdn.app");
  if (isVideo) return <FeedVideo src={url} />;

  return (
    <div className="w-full aspect-video bg-black">
      <img src={url} className="w-full h-full object-cover" alt="Post" />
    </div>
  );
};

// ── Three-dots dropdown ───────────────────────────────────────────────────────
const PostMenu = ({
  post,
  currentUserId,
  onDelete,
  onHide,
  onReport,
  onClose,
}: {
  post: any;
  currentUserId: string | null;
  onDelete: () => void;
  onHide: () => void;
  onReport: () => void;
  onClose: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.88, y: -6 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.88, y: -6 }}
    transition={{ duration: 0.13 }}
    className="absolute right-0 top-9 z-50 w-44 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
    onClick={(e) => e.stopPropagation()}
  >
    {post.author_id === currentUserId && (
      <button
        onClick={onDelete}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-semibold border-b border-white/5"
      >
        <Trash2 size={15} /> Delete
      </button>
    )}
    <button
      onClick={onHide}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-white/70 hover:bg-white/5 text-sm font-semibold border-b border-white/5"
    >
      <EyeOff size={15} /> Hide
    </button>
    <button
      onClick={onReport}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-400 hover:bg-orange-500/10 text-sm font-semibold"
    >
      <Flag size={15} /> Report
    </button>
  </motion.div>
);

// ── Main Feed ─────────────────────────────────────────────────────────────────
const FameFeed = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [reportModal, setReportModal] = useState<{
    postId: string;
    reason: string;
  } | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) =>
      setCurrentUserId(data.user?.id ?? null),
    );
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
      .channel("fame-feed-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        fetchPosts,
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleLike = async (post: any) => {
    if (likedIds.has(post.id)) return;
    setLikedIds((prev) => new Set([...prev, post.id]));
    await supabase
      .from("posts")
      .update({ likes_count: (post.likes_count || 0) + 1 })
      .eq("id", post.id);
    fetchPosts();
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("comments").insert([{
      post_id: postId,
      content: commentText,
      author: user?.user_metadata?.full_name || "Vibe User",
    }]);
    if (!error) { setCommentText(""); fetchPosts(); }
  };

  const handleDelete = async (postId: string) => {
    setOpenMenuId(null);
    await supabase.from("posts").delete().eq("id", postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleHide = (postId: string) => {
    setOpenMenuId(null);
    setHiddenIds((prev) => new Set([...prev, postId]));
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

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
        <p className="text-white/20 font-black uppercase tracking-widest text-[10px]">
          Loading Feed
        </p>
      </div>
    );

  const visiblePosts = posts.filter((p) => !hiddenIds.has(p.id));

  return (
    <>
      <AnimatePresence>
        {visiblePosts.map((post) => (
          <motion.article
            key={post.id}
            layout
            exit={{ opacity: 0, x: 80, transition: { duration: 0.28 } }}
            className="w-full border-b border-white/[0.06]"
          >
            {/* ── Post Header ── */}
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
                    Verified Creator
                  </p>
                </div>
              </div>

              {/* Three-dots */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() =>
                    setOpenMenuId(openMenuId === post.id ? null : post.id)
                  }
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <MoreVertical size={18} className="text-white/50" />
                </button>
                <AnimatePresence>
                  {openMenuId === post.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <PostMenu
                        post={post}
                        currentUserId={currentUserId}
                        onDelete={() => handleDelete(post.id)}
                        onHide={() => handleHide(post.id)}
                        onReport={() => {
                          setOpenMenuId(null);
                          setReportModal({ postId: post.id, reason: "" });
                        }}
                        onClose={() => setOpenMenuId(null)}
                      />
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Caption (above media) ── */}
            {post.content && (
              <p className="px-4 pb-3 text-sm text-white/85 leading-relaxed">
                {post.content}
              </p>
            )}

            {/* ── Media (full width, edge-to-edge) ── */}
            <PostMedia post={post} />

            {/* ── Action Bar ── */}
            <div className="flex items-center gap-5 px-4 py-3">
              <button
                onClick={() => handleLike(post)}
                className="flex items-center gap-1.5 group"
              >
                <Heart
                  size={22}
                  className={
                    likedIds.has(post.id)
                      ? "fill-red-500 text-red-500"
                      : "text-white/60 group-hover:text-red-400 transition-colors"
                  }
                />
                <span className="text-xs font-bold text-white/50">
                  {post.likes_count || 0}
                </span>
              </button>

              <button
                onClick={() =>
                  setActiveComment(
                    activeComment === post.id ? null : post.id,
                  )
                }
                className="flex items-center gap-1.5 group"
              >
                <MessageCircle
                  size={22}
                  className="text-white/60 group-hover:text-blue-400 transition-colors"
                />
                <span className="text-xs font-bold text-white/50">
                  {post.comments?.length || 0}
                </span>
              </button>

              <button
                onClick={() =>
                  navigator.share?.({ url: window.location.href })
                }
                className="flex items-center gap-1.5 group ml-auto"
              >
                <Share2
                  size={20}
                  className="text-white/60 group-hover:text-white transition-colors"
                />
              </button>
            </div>

            {/* ── Comments Inline ── */}
            <AnimatePresence>
              {activeComment === post.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden border-t border-white/5"
                >
                  <div className="px-4 pt-3 pb-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="Write a comment…"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddComment(post.id)
                      }
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      className="bg-blue-600 text-white px-4 rounded-xl"
                    >
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
                          <p className="text-xs text-white/70 mt-0.5 leading-snug">
                            {c.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.article>
        ))}
      </AnimatePresence>

      {visiblePosts.length === 0 && !loading && (
        <div className="flex flex-col items-center py-20 text-white/20">
          <p className="font-black uppercase tracking-widest text-xs">
            No posts yet
          </p>
        </div>
      )}

      {/* ── Report Modal ── */}
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
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <Flag size={18} className="text-orange-400" /> Report Post
                </h3>
                <button
                  onClick={() => setReportModal(null)}
                  className="p-1.5 rounded-full bg-white/10 text-white/60"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-white/40 text-xs mb-4 uppercase tracking-widest font-bold">
                Why are you reporting this?
              </p>
              <div className="space-y-2 mb-6">
                {[
                  "Spam or misleading",
                  "Inappropriate content",
                  "Hate speech",
                  "Harassment",
                  "Other",
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() =>
                      setReportModal((prev) =>
                        prev ? { ...prev, reason } : prev,
                      )
                    }
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
};

export default FameFeed;
