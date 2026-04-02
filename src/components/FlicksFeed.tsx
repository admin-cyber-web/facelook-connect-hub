import React, { useState, useRef, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
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

// --- 1. Single Flick Card Component (Individual Video) ---
const FlickCard = memo(
  ({ post, isActive }: { post: any; isActive: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [liked, setLiked] = useState(false);

    // Play/Pause logic based on active index
    useEffect(() => {
      if (videoRef.current) {
        if (isActive) {
          videoRef.current.currentTime = 0;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Browser block protection: play muted if unmuted fails
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                videoRef.current.play();
              }
            });
          }
        } else {
          videoRef.current.pause();
        }
      }
    }, [isActive]);

    const handleLike = async () => {
      setLiked(!liked);
      // Real-time update logic
      await supabase.rpc("increment_likes", { post_id: post.id });
    };

    return (
      <div className="relative w-full h-[100dvh] bg-black snap-start flex items-center justify-center overflow-hidden shrink-0">
        <video
          ref={videoRef}
          src={post.media_url}
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
        />

        {/* Interaction Layer (Mute toggle) */}
        <div
          className="absolute inset-0 z-10"
          onClick={() => setIsMuted(!isMuted)}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70 pointer-events-none z-20" />

        {/* Mute Pop-up Indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none transition-opacity">
          {isMuted && (
            <div className="bg-black/40 p-5 rounded-full backdrop-blur-md">
              <VolumeX size={32} className="text-white/80" />
            </div>
          )}
        </div>

        {/* Right Sidebar Actions */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6 z-40 text-white">
          {/* Profile Avatar */}
          <div className="relative mb-2">
            <div className="w-12 h-12 rounded-full border-2 border-white bg-zinc-800 flex items-center justify-center font-bold text-lg overflow-hidden shadow-xl">
              {post.author ? post.author[0].toUpperCase() : "V"}
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ff2d55] rounded-full p-0.5 border-2 border-black">
              <Plus size={14} fill="currentColor" strokeWidth={3} />
            </div>
          </div>

          {/* Like Button */}
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

          {/* Comments Button */}
          <div className="flex flex-col items-center">
            <MessageCircle
              size={32}
              fill="white"
              className="opacity-90 shadow-md"
            />
            <span className="text-[11px] font-bold mt-1">
              {post.comments?.length || 0}
            </span>
          </div>

          {/* Views Count */}
          <div className="flex flex-col items-center">
            <Eye size={30} className="opacity-90 shadow-md" />
            <span className="text-[11px] font-bold mt-1">1.5K</span>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center">
            <Share2 size={30} fill="white" className="opacity-90" />
            <span className="text-[11px] font-bold mt-1 text-center">
              Share
            </span>
          </div>

          {/* Spinning Music Disk */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            className="w-11 h-11 rounded-full border-[8px] border-zinc-800 bg-gradient-to-tr from-zinc-900 to-zinc-700 flex items-center justify-center mt-2 shadow-2xl"
          >
            <Music size={16} className="text-white/60" />
          </motion.div>
        </div>

        {/* Bottom Content Info */}
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
            {post.content ||
              "Experience the flow on FameFeed! 🚀 #Viral #Flicks #Vibe"}
          </p>

          {/* Moving Music Track Name */}
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

// --- 2. Main Container (Handles Scrolling and Fetching) ---
export default function FlicksApp() {
  const [flicks, setFlicks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch only video posts from your main feed table
  useEffect(() => {
    const fetchFlicks = async () => {
      const { data } = await supabase
        .from("posts")
        .select(`*, comments:comments(*)`)
        .order("created_at", { ascending: false });

      if (data) {
        // Only allow video formats
        const videoOnly = data.filter((p: any) =>
          p.media_url?.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)/),
        );
        setFlicks(videoOnly);
      }
      setLoading(false);
    };
    fetchFlicks();
  }, []);

  // Update which video is active based on scroll position
  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollPos = containerRef.current.scrollTop;
    const cardHeight = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollPos / cardHeight);

    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-white/40 font-bold text-[10px] tracking-widest uppercase">
          Syncing Flicks...
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex justify-center overflow-hidden touch-none">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full max-w-[500px] h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {flicks.map((post, i) => (
          <FlickCard key={post.id} post={post} isActive={i === currentIndex} />
        ))}

        {/* Fallback if no videos exist */}
        {flicks.length === 0 && (
          <div className="h-full w-full flex flex-col items-center justify-center text-white/30 p-10 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <Music size={24} />
            </div>
            <p className="text-sm font-bold">No Flicks Yet</p>
            <p className="text-xs opacity-50 mt-1">
              Post a video in the feed to see it here!
            </p>
          </div>
        )}

        {/* Side Progress Bar (Visual Only) */}
        <div className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-50 pointer-events-none">
          {flicks.slice(0, 20).map((_, i) => (
            <div
              key={i}
              className={`w-0.5 rounded-full transition-all duration-300 ${
                i === currentIndex ? "h-6 bg-white" : "h-1 bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
