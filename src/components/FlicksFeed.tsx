import React, { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { supabase } from "../lib/supabaseClient"; // Apna supabase client check kar lena
import {
  Heart,
  MessageCircle,
  Share2,
  Music,
  Volume2,
  VolumeX,
  Plus,
  Check,
  Eye,
} from "lucide-react";

// --- FlickCard: Single Video View ---
const FlickCard = memo(
  ({ post, isActive }: { post: any; isActive: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [liked, setLiked] = useState(false);

    useEffect(() => {
      if (videoRef.current) {
        if (isActive) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {
            // Autoplay protection: agar browser block kare toh mute karke chalao
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play();
            }
          });
        } else {
          videoRef.current.pause();
        }
      }
    }, [isActive]);

    const handleLike = async () => {
      setLiked(!liked);
      // Real-time update in Supabase
      await supabase.rpc("increment_likes", { post_id: post.id });
    };

    return (
      <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          src={post.media_url}
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
        />

        {/* Click anywhere to toggle mute */}
        <div
          className="absolute inset-0 z-10"
          onClick={() => setIsMuted(!isMuted)}
        />

        {/* UI Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none z-20" />

        {/* Mute Indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 opacity-0 active:opacity-100 transition-opacity">
          {isMuted ? (
            <VolumeX size={48} className="text-white/50" />
          ) : (
            <Volume2 size={48} className="text-white/50" />
          )}
        </div>

        {/* Right Sidebar Actions */}
        <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-40 text-white">
          {/* User Avatar */}
          <div className="relative mb-3">
            <div className="w-12 h-12 rounded-full border-2 border-white bg-slate-800 flex items-center justify-center font-bold text-lg overflow-hidden shadow-xl">
              {post.author ? post.author[0].toUpperCase() : "U"}
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ff2d55] rounded-full p-0.5 border-2 border-black">
              <Plus size={14} fill="currentColor" />
            </div>
          </div>

          {/* Like */}
          <button
            onClick={handleLike}
            className="flex flex-col items-center group"
          >
            <Heart
              size={32}
              fill={liked ? "#ff2d55" : "rgba(255,255,255,0.9)"}
              className={liked ? "text-[#ff2d55]" : "text-white"}
            />
            <span className="text-[11px] font-bold mt-1 shadow-sm">
              {post.likes_count || 0}
            </span>
          </button>

          {/* Comment */}
          <div className="flex flex-col items-center">
            <MessageCircle size={32} fill="white" className="opacity-90" />
            <span className="text-[11px] font-bold mt-1">
              {post.comments?.length || 0}
            </span>
          </div>

          {/* Views */}
          <div className="flex flex-col items-center">
            <Eye size={30} className="opacity-90" />
            <span className="text-[11px] font-bold mt-1">1.5K</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center">
            <Share2 size={30} fill="white" className="opacity-90" />
            <span className="text-[11px] font-bold mt-1">Share</span>
          </div>

          {/* Spinning Music Record */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-11 h-11 rounded-full border-8 border-zinc-800 bg-gradient-to-tr from-zinc-900 to-zinc-700 flex items-center justify-center mt-4"
          >
            <Music size={16} className="text-white/80" />
          </motion.div>
        </div>

        {/* Bottom Info Section */}
        <div className="absolute bottom-6 left-4 right-16 text-white z-40 pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-base">
              @{post.author || "vibe_user"}
            </h3>
            <span className="bg-blue-500 p-0.5 rounded-full">
              <Check size={10} strokeWidth={4} />
            </span>
            <button className="border border-white px-2 py-0.5 rounded-md text-[10px] font-bold ml-2">
              Follow
            </button>
          </div>

          <p className="text-sm opacity-90 mb-4 line-clamp-2 leading-snug">
            {post.content ||
              "Vibe with the rhythm! 🎬 #FameFeed #Viral #Flicks"}
          </p>

          {/* Scrolling Music Name */}
          <div className="flex items-center gap-2 max-w-[200px] overflow-hidden whitespace-nowrap">
            <Music size={14} className="animate-pulse" />
            <div className="text-xs font-medium relative overflow-hidden">
              <motion.div
                animate={{ x: [200, -200] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
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

// --- Main Flicks App Component ---
export default function FlicksApp() {
  const [flicks, setFlicks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch only videos from Supabase
  useEffect(() => {
    const getFlicks = async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`*, comments:comments(*)`)
        .order("created_at", { ascending: false });

      if (data) {
        // Filter: Sirf wahi posts jinme video file ho
        const videoPosts = data.filter((p: any) =>
          p.media_url?.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)/),
        );
        setFlicks(videoPosts);
      }
      setLoading(false);
    };
    getFlicks();
  }, []);

  const onDragEnd = (_: any, info: PanInfo) => {
    const swipeThreshold = 50;
    if (info.offset.y < -swipeThreshold && currentIndex < flicks.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (info.offset.y > swipeThreshold && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  if (loading)
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center text-white font-black uppercase tracking-widest animate-pulse">
        Loading Flicks...
      </div>
    );
  if (flicks.length === 0)
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center text-white">
        No Flicks found. Post a video!
      </div>
    );

  return (
    <div className="fixed inset-0 bg-black flex justify-center touch-none overflow-hidden">
      <div className="relative w-full max-w-[500px] h-full bg-zinc-950 shadow-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={flicks[currentIndex]?.id}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={onDragEnd}
            initial={{ opacity: 0.8, y: 300 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0.8, y: -300 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          >
            <FlickCard post={flicks[currentIndex]} isActive={true} />
          </motion.div>
        </AnimatePresence>

        {/* Progress Bar (TikTok style indicators) */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-50">
          {flicks.slice(0, 10).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-500 ${
                i === currentIndex
                  ? "h-8 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  : "h-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
