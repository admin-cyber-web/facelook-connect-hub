import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { motion, AnimatePresence, useAnimation, PanInfo } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Music,
  Play,
  Bookmark,
  X,
  Send,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Check,
  Plus,
  ShoppingBag,
} from "lucide-react";

// ─── TYPES & INTERFACES ───
interface FlickItem {
  id: number;
  author: string;
  username: string;
  avatar: string;
  videoUrl: string;
  caption: string;
  tags: string[];
  song: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
}

interface Comment {
  id: number;
  user: string;
  avatar: string;
  text: string;
  timestamp: string;
  likes: number;
}

// ─── MOCK DATA GENERATOR (50 ITEMS) ───
const generateFlicks = (): FlickItem[] => {
  const videos = [
    "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lighting-in-the-city-2189-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-4233-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-stunning-sunset-seen-from-the-beach-1101-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-driving-in-a-dark-tunnel-2103-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-vertical-shot-of-a-keyboard-and-mouse-42468-large.mp4",
  ];

  return Array.from({ length: 50 }).map((_, i) => ({
    id: i + 1,
    author: `Creator ${i + 1}`,
    username: `user_vibes_${i + 1}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
    videoUrl: videos[i % videos.length],
    caption: `This is a high-end UI experience for Flick #${i + 1}. Coding is lifestyle! 🚀 #React #FramerMotion #UI`,
    tags: ["#trending", "#viral", "#foryou"],
    song: `Original Audio - Soundscape Vol. ${i + 1}`,
    likes: Math.floor(Math.random() * 50000),
    comments: Math.floor(Math.random() * 2000),
    shares: Math.floor(Math.random() * 500),
    isLiked: false,
    isSaved: false,
    isFollowing: false,
  }));
};

// ─── HELPER: FORMAT NUMBERS (1.2K, 50M etc) ───
const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

// ─── COMPONENT: COMMENTS SECTION ───
const CommentsModal = ({
  flickId,
  onClose,
}: {
  flickId: number;
  onClose: () => void;
}) => {
  const [commentText, setCommentText] = useState("");

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute bottom-0 left-0 right-0 h-[75%] z-[60] bg-[#121212] rounded-t-3xl flex flex-col shadow-2xl border-t border-white/10"
    >
      <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2" />
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <h3 className="text-white font-bold text-sm">Comments</h3>
        <button
          onClick={onClose}
          className="bg-white/10 p-1 rounded-full text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div key={idx} className="flex gap-3">
            <img
              src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${idx + flickId}`}
              className="w-8 h-8 rounded-full"
              alt="user"
            />
            <div className="flex-1">
              <p className="text-zinc-500 text-[11px] font-bold">
                @random_user_{idx} • 2h
              </p>
              <p className="text-white text-sm mt-1">
                Bhai code bahut solid hai! Production ready lag raha hai. 🔥
              </p>
              <div className="flex gap-4 mt-2 text-zinc-500 text-[10px]">
                <button className="hover:text-white transition-colors">
                  Reply
                </button>
                <button className="hover:text-white transition-colors">
                  Translation
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 text-zinc-500">
              <Heart size={14} />
              <span className="text-[10px]">12</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-zinc-900/50 flex gap-3 items-center border-t border-white/5 pb-8">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500" />
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
        />
        <button className="text-purple-500">
          <Send size={24} />
        </button>
      </div>
    </motion.div>
  );
};

// ─── COMPONENT: SINGLE FLICK CARD ───
const FlickCard = ({
  item,
  isActive,
  onOpenComments,
}: {
  item: FlickItem;
  isActive: boolean;
  onOpenComments: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(() => setIsPlaying(false));
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  const handleInteraction = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 800);
    } else {
      if (videoRef.current) {
        isPlaying ? videoRef.current.pause() : videoRef.current.play();
        setIsPlaying(!isPlaying);
      }
    }
    lastTapRef.current = now;
  };

  return (
    <div
      className="relative w-full h-full bg-black select-none overflow-hidden"
      onClick={handleInteraction}
    >
      {/* Video Engine */}
      <video
        ref={videoRef}
        src={item.videoUrl}
        loop
        muted={isMuted}
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Heart Animation Overlay */}
      <AnimatePresence>
        {showHeartOverlay && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2.5, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
          >
            <Heart
              size={100}
              fill="#ff2d55"
              className="text-[#ff2d55] drop-shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />

      {/* Top Navbar Simulation */}
      <div className="absolute top-10 left-0 right-0 px-5 flex justify-between items-center z-30">
        <div className="flex gap-4 text-white font-bold text-sm">
          <span className="opacity-60">Following</span>
          <span className="border-b-2 border-white pb-1">For You</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
          className="text-white bg-black/20 p-2 rounded-full backdrop-blur-md"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Right Sidebar (Actions) */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6 z-30">
        <div className="relative mb-2">
          <img
            src={item.avatar}
            className="w-12 h-12 rounded-full border-2 border-white"
            alt="avatar"
          />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ff2d55] rounded-full p-0.5">
            <Plus size={14} className="text-white" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} className="text-white">
            <Heart
              size={34}
              fill={showHeartOverlay ? "#ff2d55" : "none"}
              className={showHeartOverlay ? "text-[#ff2d55]" : ""}
            />
          </motion.button>
          <span className="text-white text-[11px] font-bold">
            {formatNumber(item.likes)}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments();
            }}
            whileTap={{ scale: 0.8 }}
            className="text-white"
          >
            <MessageCircle size={34} />
          </motion.button>
          <span className="text-white text-[11px] font-bold">
            {formatNumber(item.comments)}
          </span>
        </div>

        <motion.button whileTap={{ scale: 0.8 }} className="text-white">
          <Bookmark size={32} />
        </motion.button>

        <motion.button whileTap={{ scale: 0.8 }} className="text-white">
          <Share2 size={32} />
        </motion.button>

        <motion.div
          animate={isActive ? { rotate: 360 } : {}}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          className="w-10 h-10 rounded-full border-8 border-zinc-800 bg-gradient-to-tr from-zinc-700 to-zinc-900 flex items-center justify-center"
        >
          <Music size={14} className="text-white" />
        </motion.div>
      </div>

      {/* Bottom Info Section */}
      <div className="absolute bottom-6 left-4 right-20 text-white z-30">
        <h3 className="font-bold text-lg mb-1 flex items-center gap-1">
          @{item.username}{" "}
          <Check size={14} className="bg-blue-500 rounded-full p-0.5" />
        </h3>
        <p className="text-sm line-clamp-2 leading-snug mb-3">
          {item.caption} <br />
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="font-bold mr-2 hover:underline cursor-pointer"
            >
              {tag}
            </span>
          ))}
        </p>
        <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm">
          <Music size={12} className="animate-pulse" />
          <div className="text-[11px] font-medium overflow-hidden whitespace-nowrap w-32 relative">
            <motion.p
              animate={{ x: [100, -150] }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            >
              {item.song}
            </motion.p>
          </div>
        </div>
      </div>

      {/* Video Progress Bar */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 z-40">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="h-full bg-white shadow-[0_0_10px_white]"
          />
        </div>
      )}
    </div>
  );
};

// ─── MAIN FEED COMPONENT ───
export default function FlicksProFeed() {
  const [flicks] = useState<FlickItem[]>(generateFlicks());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (showComments) return;
    const swipeThreshold = 100;
    if (info.offset.y < -swipeThreshold && currentIndex < flicks.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (info.offset.y > swipeThreshold && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#000] flex justify-center">
      <div className="relative w-full max-w-[500px] h-full shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        {/* Main Scrolling View */}
        <div className="h-full w-full overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 200,
                mass: 1,
              }}
              className="absolute inset-0"
            >
              <FlickCard
                item={flicks[currentIndex]}
                isActive={true}
                onOpenComments={() => setShowComments(true)}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global UI Elements */}
        <AnimatePresence>
          {showComments && (
            <CommentsModal
              flickId={flicks[currentIndex].id}
              onClose={() => setShowComments(false)}
            />
          )}
        </AnimatePresence>

        {/* Navigation / Indicators */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${i === currentIndex % 8 ? "h-6 bg-white" : "h-1 bg-white/30"}`}
            />
          ))}
        </div>

        {/* Bottom Tab Bar (UI Only) */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black to-transparent flex items-center justify-around px-6 z-50">
          <Plus size={28} className="text-white bg-white/20 p-1 rounded-lg" />
          <ShoppingBag size={24} className="text-white/60" />
          <MoreHorizontal size={24} className="text-white/60" />
        </div>
      </div>
    </div>
  );
}
