import React, { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import {
  Heart,
  MessageCircle,
  Share2,
  Music,
  VolumeX,
  Plus,
  Check,
  Eye,
  Disc,
} from "lucide-react";

// --- 1. Smart Media Renderer (Fixed Audio Overlap) ---
const FlickMedia = ({ post, videoRef, isMuted, isActive }: any) => {
  const url = post.media_url || "";
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

  if (isYouTube) {
    // Agar flick active nahi hai toh iframe remove kar do (Stop Audio)
    if (!isActive) return <div className="w-full h-full bg-black" />;

    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = match && match[2].length === 11 ? match[2] : null;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1&enablejsapi=1`;

    return (
      <div className="relative w-full h-full bg-black overflow-hidden pointer-events-none">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-[120%] -top-[10%] scale-[1.5]"
          allow="autoplay; encrypted-media"
          title="Flick Content"
        />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={url}
      className="w-full h-full object-cover"
      loop
      muted={isMuted}
      playsInline
    />
  );
};

// --- 2. Single Flick Card Component ---
const FlickCard = memo(
  ({ post, isActive }: { post: any; isActive: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [liked, setLiked] = useState(false);

    useEffect(() => {
      if (videoRef.current) {
        if (isActive) {
          videoRef.current.currentTime = 0;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                videoRef.current.play();
              }
            });
          }
        } else {
          // Stop and Reset normal video
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }
    }, [isActive]);

    const handleLike = async () => {
      setLiked(!liked);
      await supabase.rpc("increment_likes", { post_id: post.id });
    };

    return (
      <div className="relative w-full h-[100dvh] bg-black snap-start flex items-center justify-center overflow-hidden shrink-0">
        <FlickMedia
          post={post}
          videoRef={videoRef}
          isMuted={isMuted}
          isActive={isActive}
        />

        <div
          className="absolute inset-0 z-10"
          onClick={() => setIsMuted(!isMuted)}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none z-20" />

        {/* Mute Pop-up */}
        <AnimatePresence>
          {isMuted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
            >
              <div className="bg-black/40 p-5 rounded-full backdrop-blur-md border border-white/10">
                <VolumeX size={32} className="text-white/80" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Sidebar Actions */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6 z-40 text-white">
          <div className="relative mb-2">
            <div className="w-12 h-12 rounded-full border-2 border-white bg-zinc-800 flex items-center justify-center font-bold text-lg overflow-hidden shadow-xl">
              {post.author ? post.author[0].toUpperCase() : "V"}
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ff2d55] rounded-full p-0.5 border-2 border-black">
              <Plus size={14} fill="currentColor" strokeWidth={3} />
            </div>
          </div>

          <button onClick={handleLike} className="flex flex-col items-center">
            <Heart
              size={32}
              fill={liked ? "#ff2d55" : "white"}
              className={`${liked ? "text-[#ff2d55]" : "text-white"} transition-transform active:scale-125`}
            />
            <span className="text-[11px] font-bold mt-1 drop-shadow-md">
              {post.likes_count || 0}
            </span>
          </button>

          <div className="flex flex-col items-center">
            <MessageCircle size={32} fill="white" className="opacity-90" />
            <span className="text-[11px] font-bold mt-1">
              {post.comments?.length || 0}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <Eye size={30} className="opacity-90" />
            <span className="text-[11px] font-bold mt-1">1.5K</span>
          </div>

          <div className="flex flex-col items-center">
            <Share2 size={30} fill="white" className="opacity-90" />
            <span className="text-[11px] font-bold mt-1">Share</span>
          </div>

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
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-base drop-shadow-lg">
              @{post.author || "vibe_user"}
            </h3>
            <span className="bg-blue-500 p-0.5 rounded-full shadow-lg">
              <Check size={10} strokeWidth={4} />
            </span>
          </div>
          <p className="text-sm opacity-90 mb-4 line-clamp-2 leading-snug drop-shadow-md">
            {post.content}
          </p>
          <div className="flex items-center gap-2 max-w-[200px] bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full w-fit border border-white/10">
            <Music size={12} className="animate-pulse" />
            <div className="text-[10px] font-medium whitespace-nowrap overflow-hidden">
              <motion.div
                animate={{ x: [160, -160] }}
                transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
              >
                Original Sound - {post.author || "User"} Music
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

// --- 3. Main Container ---
export default function FlicksApp() {
  const [flicks, setFlicks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchFlicks = async () => {
      const { data } = await supabase
        .from("posts")
        .select(`*, comments:comments(*)`)
        .order("created_at", { ascending: false });
      if (data) {
        const videos = data.filter(
          (p: any) =>
            p.media_url?.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)/) ||
            p.media_url?.includes("youtube.com") ||
            p.media_url?.includes("youtu.be"),
        );
        setFlicks(videos);
      }
      setTimeout(() => setLoading(false), 2000);
    };
    fetchFlicks();
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const newIndex = Math.round(
      containerRef.current.scrollTop / containerRef.current.clientHeight,
    );
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
  };

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
            <span className="text-[8px] text-zinc-500 font-black tracking-[0.3em] uppercase italic">
              Facelook Flicks
            </span>
          </div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 text-white font-black italic text-xl tracking-tighter"
        >
          POWERED BY <span className="text-blue-500">FACELOOK</span>
        </motion.p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex justify-center overflow-hidden touch-none">
      {/* Stylish Movie Intro Header */}
      <div className="fixed top-0 left-0 w-full z-[100] flex justify-center pt-8 pointer-events-none">
        <motion.div
          key={currentIndex} // Trigger on scroll
          initial={{ scale: 3, opacity: 0, filter: "blur(20px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative"
        >
          <h1 className="text-white font-black italic text-3xl tracking-tighter drop-shadow-2xl mix-blend-difference">
            FLI<span className="text-blue-500">CKS</span>
          </h1>
          {/* Subtle Glitch Layer */}
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
        {flicks.map((post, i) => (
          <FlickCard key={post.id} post={post} isActive={i === currentIndex} />
        ))}

        <div className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-50 pointer-events-none px-2">
          {flicks.slice(0, 15).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: i === currentIndex ? 30 : 6,
                backgroundColor:
                  i === currentIndex ? "#3b82f6" : "rgba(255,255,255,0.1)",
              }}
              className="w-1 rounded-full transition-all duration-300"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
