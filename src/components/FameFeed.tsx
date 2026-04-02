import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Send,
  Heart,
  MessageCircle,
  Share2,
  MoreVertical,
  Loader2,
  Volume2,
  VolumeX,
  Trash2,
  EyeOff,
  Flag,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

let isGlobalUnmuted = false;

const AutoPlayVideo = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(!isGlobalUnmuted);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (videoRef.current) {
          if (entry.isIntersecting) {
            videoRef.current.muted = !isGlobalUnmuted;
            setIsMuted(!isGlobalUnmuted);
            videoRef.current.play().catch(() => {
              videoRef.current!.muted = true;
              videoRef.current!.play();
            });
          } else {
            videoRef.current.pause();
          }
        }
      },
      { threshold: 0.7 },
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [src]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMuteState = !videoRef.current.muted;
      videoRef.current.muted = newMuteState;
      isGlobalUnmuted = !newMuteState;
      setIsMuted(newMuteState);
    }
  };

  return (
    <div className="relative w-full h-full group bg-black">
      <div className="absolute top-8 left-6 z-30 pointer-events-none select-none drop-shadow-2xl">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-[-4px]">
            Facelook
          </span>
          <span className="text-2xl font-black text-white italic tracking-tighter">
            by FLICKS
          </span>
        </div>
      </div>
      <video
        ref={videoRef}
        src={src}
        loop
        muted={isMuted}
        playsInline
        className="w-full h-full object-cover block cursor-pointer"
        onClick={toggleMute}
      />
      <div
        onClick={toggleMute}
        className="absolute bottom-24 left-6 z-40 p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 cursor-pointer transition-all active:scale-90"
      >
        {isMuted ? (
          <VolumeX size={22} className="text-red-500" />
        ) : (
          <Volume2 size={22} className="text-blue-400" />
        )}
      </div>
    </div>
  );
};

const MediaRenderer = ({ post }: { post: any }) => {
  const url = post.media_url;
  if (!url)
    return (
      <div className="w-full h-full bg-gradient-to-b from-slate-800 to-black" />
    );

  const isYouTube =
    post.metadata?.is_youtube ||
    url.includes("youtube.com") ||
    url.includes("youtu.be");

  if (isYouTube) {
    let embedUrl = url;
    if (!url.includes("embed")) {
      const regExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/shorts\/)([^#\&\?]*).*/;
      const match = url.match(regExp);
      const videoId = match && match[2].length === 11 ? match[2] : null;
      embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&iv_load_policy=3`;
    }
    return (
      <div className="relative w-full h-full bg-black overflow-hidden">
        <div className="absolute top-8 left-6 z-30 pointer-events-none flex flex-col drop-shadow-lg">
          <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">
            Facelook
          </span>
          <span className="text-xl font-black text-white italic">
            by FLICKS
          </span>
        </div>
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-[120%] -top-[10%] pointer-events-none scale-[1.3]"
          allow="autoplay; encrypted-media"
          title="YouTube Flick"
        />
      </div>
    );
  }

  const isVideoFile =
    post.type === "video" ||
    /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]) ||
    url.includes("rapidcdn.app");

  if (isVideoFile) return <AutoPlayVideo src={url} />;

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-8 left-6 z-30 pointer-events-none flex flex-col drop-shadow-lg">
        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">
          Facelook
        </span>
        <span className="text-xl font-black text-white italic">by FLICKS</span>
      </div>
      <img src={url} className="w-full h-full object-cover" alt="Flick" />
    </div>
  );
};

const FameFeed = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(`*, comments:comments(*)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPosts(data ?? []);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    const sub = supabase
      .channel("realtime-flicks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => fetchPosts(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const handleLike = async (id: string, current: number) => {
    await supabase
      .from("posts")
      .update({ likes_count: (current || 0) + 1 })
      .eq("id", id);
    fetchPosts();
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("comments").insert([
      {
        post_id: postId,
        content: commentText,
        author: user?.user_metadata?.full_name || "Vibe User",
      },
    ]);
    if (!error) {
      setCommentText("");
      fetchPosts();
    }
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
    if (!reportModal || !reportModal.reason.trim()) return;
    setReportSubmitting(true);
    await supabase.from("reports").insert([
      {
        post_id: reportModal.postId,
        reporter_id: currentUserId,
        reason: reportModal.reason.trim(),
      },
    ]);
    setReportSubmitting(false);
    setReportModal(null);
  };

  if (loading)
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
        <p className="text-white/20 font-black uppercase tracking-[0.4em] text-[10px]">
          Loading Flicks
        </p>
      </div>
    );

  const visiblePosts = posts.filter((p) => !hiddenIds.has(p.id));

  return (
    <>
      <div className="w-full h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth bg-black no-scrollbar">
        <AnimatePresence>
          {visiblePosts.map((post) => (
            <motion.div
              key={post.id}
              layout
              initial={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 120, transition: { duration: 0.35 } }}
              className="w-full h-screen snap-start snap-always relative overflow-hidden bg-black"
            >
              {/* Background Content */}
              <div className="absolute inset-0 z-0">
                <MediaRenderer post={post} />
              </div>

              {/* Backdrop tap-away to close menu */}
              {openMenuId === post.id && (
                <div
                  className="absolute inset-0 z-40"
                  onClick={() => setOpenMenuId(null)}
                />
              )}

              {/* Top UI Overlay */}
              <div className="absolute top-0 inset-x-0 z-50 p-6 pt-14 bg-gradient-to-b from-black/70 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white/30 bg-blue-600 flex items-center justify-center text-white font-black">
                      {post.author?.[0] || "V"}
                    </div>
                    <div>
                      <h4 className="text-white font-black text-sm drop-shadow-md">
                        {post.author || "Vibe User"}
                      </h4>
                      <p className="text-[9px] text-blue-400 font-black tracking-tighter uppercase">
                        Verified Creator
                      </p>
                    </div>
                  </div>

                  {/* Three-dots button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(
                          openMenuId === post.id ? null : post.id,
                        );
                      }}
                      className="p-2 rounded-full bg-black/30 backdrop-blur-md border border-white/10 active:scale-90 transition-transform"
                    >
                      <MoreVertical size={20} className="text-white" />
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {openMenuId === post.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.85, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-12 z-50 w-44 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {post.author_id === currentUserId && (
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-semibold border-b border-white/5"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          )}
                          <button
                            onClick={() => handleHide(post.id)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-white/80 hover:bg-white/5 transition-colors text-sm font-semibold border-b border-white/5"
                          >
                            <EyeOff size={16} />
                            Hide
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              setReportModal({ postId: post.id, reason: "" });
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-400 hover:bg-orange-500/10 transition-colors text-sm font-semibold"
                          >
                            <Flag size={16} />
                            Report
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Side Actions */}
              <div className="absolute right-4 bottom-32 z-40 flex flex-col gap-6 items-center">
                <button
                  onClick={() => handleLike(post.id, post.likes_count)}
                  className="flex flex-col items-center group"
                >
                  <div
                    className={`p-3 rounded-full backdrop-blur-xl ${post.likes_count > 0 ? "bg-red-500" : "bg-white/10"}`}
                  >
                    <Heart
                      size={26}
                      className={
                        post.likes_count > 0
                          ? "fill-white text-white"
                          : "text-white"
                      }
                    />
                  </div>
                  <span className="text-[10px] font-black text-white mt-1">
                    {post.likes_count || 0}
                  </span>
                </button>

                <button
                  onClick={() => setActiveComment(post.id)}
                  className="flex flex-col items-center"
                >
                  <div className="p-3 rounded-full bg-white/10 backdrop-blur-xl">
                    <MessageCircle size={26} className="text-white" />
                  </div>
                  <span className="text-[10px] font-black text-white mt-1">
                    {post.comments?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => navigator.share?.({ url: window.location.href })}
                  className="flex flex-col items-center"
                >
                  <div className="p-3 rounded-full bg-white/10 backdrop-blur-xl">
                    <Share2 size={26} className="text-white" />
                  </div>
                  <span className="text-[10px] font-black text-white mt-1 uppercase">
                    Share
                  </span>
                </button>
              </div>

              {/* Bottom Info Bar */}
              <div className="absolute bottom-0 inset-x-0 z-40 p-6 pb-12 bg-gradient-to-t from-black/90 via-black/20 to-transparent">
                <div className="max-w-[80%]">
                  {post.content && (
                    <p className="text-white text-sm font-medium mb-4 line-clamp-2 drop-shadow-lg leading-snug">
                      {post.content}
                    </p>
                  )}
                </div>
              </div>

              {/* Comment Bottom Sheet */}
              <AnimatePresence>
                {activeComment === post.id && (
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    className="absolute inset-x-0 bottom-0 z-[60] bg-slate-900 rounded-t-[2.5rem] p-6 pb-12 border-t border-white/10 shadow-2xl"
                  >
                    <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
                    <div className="flex gap-2 mb-6">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        className="bg-blue-600 text-white p-4 rounded-2xl"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                    <div className="space-y-4 max-h-72 overflow-y-auto no-scrollbar">
                      {post.comments?.map((c: any) => (
                        <div
                          key={c.id}
                          className="flex gap-4 p-2 rounded-xl bg-white/5 border border-white/5"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400 shrink-0">
                            {c.author?.[0]}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">
                              {c.author}
                            </p>
                            <p className="text-xs text-white/80 leading-relaxed mt-0.5">
                              {c.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setActiveComment(null)}
                      className="w-full mt-8 text-white/20 text-[10px] font-black uppercase tracking-widest"
                    >
                      Close Flicks Chat
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Report Modal */}
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
                  <Flag size={18} className="text-orange-400" />
                  Report Post
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
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black text-sm uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
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
