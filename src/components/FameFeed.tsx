import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Send, Heart, MessageCircle, Share2, MoreVertical,
  Loader2, Trash2, EyeOff, Flag, X, Volume2, VolumeX, Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Inline video ───────────────────────────────────────────────────────────────
const FeedVideo = ({ src }: { src: string }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!ref.current) return;
      if (entry.isIntersecting) {
        ref.current.muted = false;
        ref.current.play().catch(() => {
          if (ref.current) { ref.current.muted = true; setMuted(true); ref.current.play().catch(() => {}); }
        });
      } else { ref.current.pause(); }
    }, { threshold: 0.4 });
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
      <video ref={ref} src={src} loop muted={muted} playsInline className="w-full h-full object-cover" />
      <button onClick={toggle} className="absolute bottom-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-full border border-white/15">
        {muted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} className="text-blue-500" />}
      </button>
    </div>
  );
};

// ── YouTube embed ──────────────────────────────────────────────────────────────
const YouTubeEmbed = ({ url }: { url: string }) => {
  const m = url.match(/^.*(youtu.be\/|v\/|embed\/|watch\?v=|\/shorts\/)([^#&?]*).*/);
  const id = m?.[2]?.length === 11 ? m[2] : null;
  if (!id) return null;
  return (
    <div className="w-full bg-black" style={{ aspectRatio: "16/9" }}>
      <iframe src={`https://www.youtube.com/embed/${id}?controls=1&modestbranding=1`}
        className="w-full h-full" allow="accelerometer; autoplay; encrypted-media" title="Video" />
    </div>
  );
};

// ── Smart media renderer ───────────────────────────────────────────────────────
const PostMedia = ({ post }: { post: any }) => {
  const url = post.media_url;
  if (!url) return null;
  const isYT = post.metadata?.is_youtube || url.includes("youtube.com") || url.includes("youtu.be");
  if (isYT) return <YouTubeEmbed url={url} />;
  const isVid = post.type === "video" || /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]) || url.includes("rapidcdn.app");
  if (isVid) return <FeedVideo src={url} />;
  return (
    <div className="w-full bg-gray-100">
      <img src={url} loading="lazy" className="w-full object-cover" style={{ maxHeight: "70vh" }} alt="" />
    </div>
  );
};

// ── Post caption — 2-line clamp + "...more" toggle ────────────────────────────
const CLAMP_THRESHOLD = 90;

const PostCaption = ({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > CLAMP_THRESHOLD;
  return (
    <div className="px-4 pb-2">
      <p className={`text-[13px] text-gray-800 leading-snug whitespace-pre-wrap break-words ${!expanded && isLong ? "line-clamp-2" : ""}`}>
        {content}
      </p>
      {isLong && (
        <button onClick={() => setExpanded(v => !v)}
          className="text-blue-600 text-[12px] font-semibold mt-0.5">
          {expanded ? "...less" : "...more"}
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
    const { data } = await supabase.from("posts")
      .select(`*, comments:comments(*)`)
      .order("created_at", { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
    const sub = supabase.channel("fame-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, fetchPosts)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleLike = async (post: any) => {
    if (likedIds.has(post.id)) return;
    setLikedIds(p => new Set([...p, post.id]));
    await supabase.from("posts").update({ likes_count: (post.likes_count || 0) + 1 }).eq("id", post.id);
    fetchPosts();
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("comments").insert([{
      post_id: postId, content: commentText,
      author: user?.user_metadata?.full_name || "Vibe User",
    }]);
    setCommentText("");
    fetchPosts();
  };

  const handleDelete = async (postId: string) => {
    setOpenMenuId(null);
    await supabase.from("posts").delete().eq("id", postId);
    setPosts(p => p.filter(x => x.id !== postId));
  };

  const handleHide = (postId: string) => { setOpenMenuId(null); setHiddenIds(p => new Set([...p, postId])); };

  const handleReportSubmit = async () => {
    if (!reportModal?.reason.trim()) return;
    setReportSubmitting(true);
    await supabase.from("reports").insert([{ post_id: reportModal.postId, reporter_id: currentUserId, reason: reportModal.reason.trim() }]);
    setReportSubmitting(false);
    setReportModal(null);
  };

  const visiblePosts = posts.filter(p => !hiddenIds.has(p.id));

  return (
    <div className="bg-gray-50">
      {/* ── "What's on your mind" bar ──────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        {userProfile?.avatar_url ? (
          <img src={userProfile.avatar_url} loading="lazy"
            className="w-10 h-10 rounded-full object-cover border border-gray-200 cursor-pointer shrink-0"
            onClick={onPostClick} />
        ) : (
          <div onClick={onPostClick}
            className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm border border-gray-200 cursor-pointer shrink-0">
            {userProfile?.full_name?.[0] || "U"}
          </div>
        )}
        <div onClick={onPostClick}
          className="flex-1 bg-gray-100 py-2.5 px-4 rounded-full text-gray-400 text-sm font-medium border border-gray-200 cursor-pointer">
          What's on your mind?
        </div>
        <button className="p-2 active:scale-90 transition-transform shrink-0"
          onClick={() => galleryInputRef.current?.click()}>
          <ImageIcon size={22} className="text-blue-600" />
        </button>
        <input ref={galleryInputRef} type="file" accept="image/*,video/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (!f) return; onImageSelect?.(f); onPostClick?.(); e.target.value = ""; }} />
      </div>

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 bg-white">
          <Loader2 className="animate-spin text-blue-500 mb-2" size={26} />
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Loading Feed</p>
        </div>
      )}

      {/* ── Posts ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {visiblePosts.map(post => {
          const isVideo = post.type === "video" || post.metadata?.is_youtube ||
            (post.media_url && (/\.(mp4|webm|ogg|mov|m4v)/i.test(post.media_url.split("?")[0]) ||
              post.media_url.includes("youtube.com") || post.media_url.includes("youtu.be") || post.media_url.includes("rapidcdn.app")));

          return (
            <motion.article key={post.id} layout
              exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
              className="bg-white border-b border-gray-100"
            >
              {/* ── Post header ── */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 border border-gray-100">
                    {post.author?.[0]?.toUpperCase() || "V"}
                  </div>
                  <div>
                    <p className="text-gray-900 font-bold text-sm leading-none">{post.author || "Vibe User"}</p>
                    <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mt-0.5">
                      {isVideo ? "🎬 Reel" : "📷 Post"} · Verified Creator
                    </p>
                  </div>
                </div>
                {/* Three-dots */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                    <MoreVertical size={18} className="text-gray-400" />
                  </button>
                  <AnimatePresence>
                    {openMenuId === post.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.88, y: -6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.88, y: -6 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 top-10 z-50 w-44 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xl"
                          onClick={e => e.stopPropagation()}
                        >
                          {post.author_id === currentUserId && (
                            <button onClick={() => handleDelete(post.id)}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 hover:bg-red-50 text-sm font-semibold border-b border-gray-100">
                              <Trash2 size={15} /> Delete
                            </button>
                          )}
                          <button onClick={() => handleHide(post.id)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-600 hover:bg-gray-50 text-sm font-semibold border-b border-gray-100">
                            <EyeOff size={15} /> Hide
                          </button>
                          <button onClick={() => { setOpenMenuId(null); setReportModal({ postId: post.id, reason: "" }); }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-500 hover:bg-orange-50 text-sm font-semibold">
                            <Flag size={15} /> Report
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ── Caption (2-line clamp) then image ── */}
              {post.content && <PostCaption content={post.content} />}

              {/* ── Media ── */}
              <PostMedia post={post} />

              {/* ── Action bar ── */}
              <div className="flex items-center gap-5 px-4 py-2.5">
                <button onClick={() => handleLike(post)} className="flex items-center gap-1.5 group">
                  <Heart size={22}
                    className={likedIds.has(post.id) ? "fill-red-500 text-red-500" : "text-gray-400 group-hover:text-red-400 transition-colors"} />
                  <span className="text-xs font-bold text-gray-500">{post.likes_count || 0}</span>
                </button>
                <button onClick={() => setActiveComment(activeComment === post.id ? null : post.id)}
                  className="flex items-center gap-1.5 group">
                  <MessageCircle size={22} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs font-bold text-gray-500">{post.comments?.length || 0}</span>
                </button>
                <button onClick={() => navigator.share?.({ url: window.location.href })}
                  className="flex items-center gap-1.5 group ml-auto">
                  <Share2 size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                </button>
              </div>

              {/* ── Inline comments ── */}
              <AnimatePresence>
                {activeComment === post.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-gray-100">
                    <div className="px-4 pt-3 pb-1 flex gap-2">
                      <input type="text" placeholder="Write a comment…"
                        className="flex-1 bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-400/30"
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAddComment(post.id)} />
                      <button onClick={() => handleAddComment(post.id)}
                        className="bg-blue-600 text-white px-4 rounded-xl">
                        <Send size={16} />
                      </button>
                    </div>
                    <div className="px-4 py-2 space-y-2 max-h-48 overflow-y-auto">
                      {post.comments?.map((c: any) => (
                        <div key={c.id} className="flex gap-3 py-1">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0">
                            {c.author?.[0]}
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight">{c.author}</span>
                            <p className="text-xs text-gray-600 mt-0.5 leading-snug">{c.content}</p>
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
        <div className="flex flex-col items-center py-20 text-gray-300 bg-white">
          <p className="font-black uppercase tracking-widest text-xs">No posts yet</p>
        </div>
      )}

      {/* ── Report modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {reportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setReportModal(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10 border-t border-gray-100 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-gray-900 font-black text-lg flex items-center gap-2">
                  <Flag size={18} className="text-orange-500" /> Report Post
                </h3>
                <button onClick={() => setReportModal(null)} className="p-1.5 rounded-full bg-gray-100 text-gray-500">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2 mb-5">
                {["Spam or misleading", "Inappropriate content", "Hate speech", "Harassment", "Other"].map(r => (
                  <button key={r} onClick={() => setReportModal(p => p ? { ...p, reason: r } : p)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-semibold border transition-all ${
                      reportModal.reason === r
                        ? "bg-orange-50 border-orange-300 text-orange-700"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
              <button onClick={handleReportSubmit} disabled={!reportModal.reason || reportSubmitting}
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black text-sm uppercase tracking-wider disabled:opacity-40">
                {reportSubmitting ? "Submitting…" : "Submit Report"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FameFeed;
