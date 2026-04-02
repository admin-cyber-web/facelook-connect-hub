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
import ConnectionPanel from "./ConnectionPanel";

// ── Full-screen video with unmuted-first autoplay ────────────────────────────
const FullVideo = ({ src }: { src: string }) => {
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
            // browser blocked unmuted — fallback to muted
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
      { threshold: 0.6 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    ref.current.muted = !ref.current.muted;
    setMuted(ref.current.muted);
  };

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={ref}
        src={src}
        loop
        muted={muted}
        playsInline
        className="w-full h-full object-cover"
        onClick={toggleMute}
      />
      <button
        onClick={toggleMute}
        className="absolute bottom-28 left-4 z-30 p-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/15"
      >
        {muted ? (
          <VolumeX size={20} className="text-red-400" />
        ) : (
          <Volume2 size={20} className="text-blue-400" />
        )}
      </button>
    </div>
  );
};

// ── YouTube full-screen ───────────────────────────────────────────────────────
const FullYouTube = ({ url, isActive }: { url: string; isActive: boolean }) => {
  if (!isActive) return <div className="absolute inset-0 bg-black" />;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  const id = match?.[2]?.length === 11 ? match[2] : null;
  if (!id) return null;
  return (
    <div className="absolute inset-0 bg-black overflow-hidden pointer-events-none">
      <iframe
        src={`https://www.youtube.com/embed/${id}?autoplay=1&mute=0&loop=1&playlist=${id}&controls=0&modestbranding=1`}
        className="absolute inset-0 w-full h-[130%] -top-[15%] scale-[1.2]"
        allow="autoplay; encrypted-media"
        title="Video"
      />
    </div>
  );
};

// ── Smart media fill ──────────────────────────────────────────────────────────
const SlideMedia = ({ post, isActive }: { post: any; isActive: boolean }) => {
  const url = post.media_url;
  if (!url)
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-black" />
    );

  const isYT =
    post.metadata?.is_youtube ||
    url.includes("youtube.com") ||
    url.includes("youtu.be");
  if (isYT) return <FullYouTube url={url} isActive={isActive} />;

  const isVid =
    post.type === "video" ||
    /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]) ||
    url.includes("rapidcdn.app");
  if (isVid) return <FullVideo src={url} />;

  return (
    <div className="absolute inset-0">
      <img src={url} className="w-full h-full object-cover" alt="" />
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
interface FameFeedProps {
  onPostClick?: () => void;
  userProfile?: any;
}

const FameFeed = ({ onPostClick, userProfile }: FameFeedProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [reportModal, setReportModal] = useState<{
    postId: string;
    reason: string;
  } | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

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
      .channel("fame-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, fetchPosts)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const idx = Math.round(
      containerRef.current.scrollTop / containerRef.current.clientHeight,
    );
    setActiveIndex(idx);
  };

  const handleLike = async (post: any) => {
    if (likedIds.has(post.id)) return;
    setLikedIds((p) => new Set([...p, post.id]));
    await supabase
      .from("posts")
      .update({ likes_count: (post.likes_count || 0) + 1 })
      .eq("id", post.id);
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
  // slide index: 0 = agora slide, 1..n = posts
  const postActiveIndex = activeIndex - 1;

  return (
    <>
      {/* ── Snap scroll container: fixed fullscreen ───────────────────── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="fixed inset-0 z-[50] overflow-y-scroll snap-y snap-mandatory bg-black"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* ── SLIDE 0: Agora / Connection ─────────────────────────────── */}
        <div className="h-screen w-full snap-start snap-always flex flex-col overflow-y-auto bg-[#020617]">
          {/* "What's on your mind" bar */}
          <div
            className="bg-white/5 backdrop-blur-xl px-4 py-3 flex items-center gap-3 border-b border-white/10 cursor-pointer active:bg-white/10 shrink-0"
            onClick={onPostClick}
          >
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                className="w-10 h-10 rounded-full object-cover border-2 border-blue-500/30"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm border-2 border-blue-500/30">
                {userProfile?.full_name?.[0] || "U"}
              </div>
            )}
            <div className="flex-1 bg-white/5 py-2.5 px-5 rounded-full text-white/40 text-sm font-semibold border border-white/5">
              What's on your mind?
            </div>
            <ImageIcon size={20} className="text-blue-400 shrink-0" />
          </div>

          {/* Agora connection panel */}
          <div className="flex-1 overflow-y-auto">
            <ConnectionPanel />
          </div>

          {/* Scroll-down hint */}
          <div className="py-4 flex flex-col items-center pointer-events-none shrink-0">
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="text-white/20 text-[10px] font-black uppercase tracking-widest"
            >
              ↓ Scroll for Feed
            </motion.div>
          </div>
        </div>

        {/* ── SLIDES 1..n: Posts ──────────────────────────────────────── */}
        {loading ? (
          <div className="h-screen w-full snap-start flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={36} />
          </div>
        ) : (
          <AnimatePresence>
            {visiblePosts.map((post, i) => (
              <motion.div
                key={post.id}
                exit={{ opacity: 0, x: 100, transition: { duration: 0.25 } }}
                className="relative h-screen w-full snap-start snap-always overflow-hidden bg-black"
              >
                {/* Full-screen media */}
                <SlideMedia post={post} isActive={i === postActiveIndex} />

                {/* Dark gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none z-10" />

                {/* Tap backdrop to close menu */}
                {openMenuId === post.id && (
                  <div
                    className="absolute inset-0 z-20"
                    onClick={() => setOpenMenuId(null)}
                  />
                )}

                {/* ── TOP: Author + three-dots ── */}
                <div className="absolute top-0 inset-x-0 z-30 px-4 pt-12 pb-6 bg-gradient-to-b from-black/60 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-white/25 flex items-center justify-center text-white font-black">
                        {post.author?.[0]?.toUpperCase() || "V"}
                      </div>
                      <div>
                        <p className="text-white font-black text-sm drop-shadow">
                          {post.author || "Vibe User"}
                        </p>
                        <p className="text-[9px] text-blue-400 font-black uppercase tracking-wider">
                          Verified Creator
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === post.id ? null : post.id);
                        }}
                        className="p-2 rounded-full bg-black/30 backdrop-blur-md border border-white/10"
                      >
                        <MoreVertical size={18} className="text-white" />
                      </button>

                      <AnimatePresence>
                        {openMenuId === post.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.85, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.85, y: -6 }}
                            transition={{ duration: 0.13 }}
                            className="absolute right-0 top-11 z-50 w-44 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
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
                              onClick={() => {
                                setOpenMenuId(null);
                                setReportModal({ postId: post.id, reason: "" });
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-400 hover:bg-orange-500/10 text-sm font-semibold"
                            >
                              <Flag size={15} /> Report
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Like / Comment / Share ── */}
                <div className="absolute right-4 bottom-28 z-30 flex flex-col items-center gap-6">
                  <button
                    onClick={() => handleLike(post)}
                    className="flex flex-col items-center"
                  >
                    <div className={`p-3 rounded-full backdrop-blur-xl ${likedIds.has(post.id) ? "bg-red-500" : "bg-black/30 border border-white/15"}`}>
                      <Heart
                        size={24}
                        className={likedIds.has(post.id) ? "fill-white text-white" : "text-white"}
                      />
                    </div>
                    <span className="text-[10px] font-black text-white mt-1 drop-shadow">
                      {post.likes_count || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveComment(activeComment === post.id ? null : post.id)}
                    className="flex flex-col items-center"
                  >
                    <div className="p-3 rounded-full bg-black/30 border border-white/15 backdrop-blur-xl">
                      <MessageCircle size={24} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black text-white mt-1 drop-shadow">
                      {post.comments?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => navigator.share?.({ url: window.location.href })}
                    className="flex flex-col items-center"
                  >
                    <div className="p-3 rounded-full bg-black/30 border border-white/15 backdrop-blur-xl">
                      <Share2 size={24} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black text-white mt-1 drop-shadow uppercase">
                      Share
                    </span>
                  </button>
                </div>

                {/* ── BOTTOM: Caption ── */}
                <div className="absolute bottom-0 inset-x-0 z-30 px-4 pb-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                  {post.content && (
                    <p className="text-white text-sm font-medium line-clamp-3 drop-shadow leading-snug max-w-[80%]">
                      {post.content}
                    </p>
                  )}
                </div>

                {/* ── Comment bottom sheet ── */}
                <AnimatePresence>
                  {activeComment === post.id && (
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", stiffness: 320, damping: 30 }}
                      className="absolute inset-x-0 bottom-0 z-[60] bg-zinc-900/95 backdrop-blur-2xl rounded-t-[2rem] p-5 pb-10 border-t border-white/10 shadow-2xl"
                    >
                      <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />
                      <div className="flex gap-2 mb-4">
                        <input
                          type="text"
                          placeholder="Add a comment…"
                          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          className="bg-blue-600 text-white px-4 rounded-2xl"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {post.comments?.map((c: any) => (
                          <div key={c.id} className="flex gap-3 p-2 rounded-xl bg-white/5">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400 shrink-0">
                              {c.author?.[0]}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-tight">
                                {c.author}
                              </p>
                              <p className="text-xs text-white/75 mt-0.5">{c.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setActiveComment(null)}
                        className="w-full mt-5 text-white/20 text-[10px] font-black uppercase tracking-widest"
                      >
                        Close
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Report Modal ─────────────────────────────────────────────────────── */}
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
