import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Send,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Bookmark,
  Loader2,
  WifiOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- 1. AutoPlay Video Component (Full Screen + Watermark) ---
const AutoPlayVideo = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (videoRef.current) {
          if (entry.isIntersecting) {
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

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <div className="relative w-full h-full group bg-black">
      {/* Watermark Overlay */}
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

      {/* Mute Indicator */}
      <div className="absolute bottom-24 right-6 z-30 p-2 bg-black/20 backdrop-blur-md rounded-full text-white pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </div>
    </div>
  );
};

// --- 2. Smart Media Renderer ---
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
        {/* YT Watermark Overlay */}
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

  if (loading)
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
        <p className="text-white/20 font-black uppercase tracking-[0.4em] text-[10px]">
          Loading Flicks
        </p>
      </div>
    );

  return (
    <div className="w-full h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth bg-black no-scrollbar">
      {posts.map((post) => (
        <motion.div
          key={post.id}
          className="w-full h-screen snap-start snap-always relative overflow-hidden bg-black"
        >
          {/* Background Content */}
          <div className="absolute inset-0 z-0">
            <MediaRenderer post={post} />
          </div>

          {/* Top UI Overlay */}
          <div className="absolute top-0 inset-x-0 z-40 p-6 pt-14 bg-gradient-to-b from-black/70 to-transparent">
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
              <MoreHorizontal className="text-white/60" />
            </div>
          </div>

          {/* Side Actions (Floating Right) */}
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
    </div>
  );
};

export default FameFeed;
