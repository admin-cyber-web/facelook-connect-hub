import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  memo,
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
  Check,
  Plus,
  MoreHorizontal,
  ShoppingBag,
  Flag,
  UserPlus,
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
  location?: string;
}

interface Comment {
  id: number;
  user: string;
  avatar: string;
  text: string;
  timestamp: string;
  likes: number;
  replies?: number;
}

// ─── STABLE VIDEO SOURCES ───
const STABLE_VIDEOS = [
  "https://player.vimeo.com/external/370331493.sd.mp4?s=338d350efc21bc4485544400c6a0665353909787&profile_id=139&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/517090025.sd.mp4?s=f024765798e947f6311e9f1a04d538676f2f9f8e&profile_id=139&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/485601140.sd.mp4?s=3e54545229415494d49a466860d5b4d4f828a2b5&profile_id=139&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/394939023.sd.mp4?s=734e5656111f62939c4a856f6a7597f1f83c66f7&profile_id=139&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/459389137.sd.mp4?s=894376483c6131c261775f0a06ec1405e3a89047&profile_id=139&oauth2_token_id=57447761",
];

// ─── DATA GENERATOR (50 ITEMS) ───
const generateFlicks = (): FlickItem[] => {
  return Array.from({ length: 50 }).map((_, i) => ({
    id: i + 1,
    author: `Creator ${i + 1}`,
    username: `vibes_master_${i + 1}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 100}`,
    videoUrl: STABLE_VIDEOS[i % STABLE_VIDEOS.length],
    caption: `Full-stack Developer Life! Video #${i + 1}. Build, Test, Deploy. 🚀💻`,
    tags: ["#coding", "#reactjs", "#framer", "#uidesign"],
    song: `Original Audio - Tech Vibes Vol. ${i + 1}`,
    likes: Math.floor(Math.random() * 80000),
    comments: Math.floor(Math.random() * 3000),
    shares: Math.floor(Math.random() * 1500),
    isLiked: false,
    isSaved: false,
    isFollowing: false,
    location: i % 3 === 0 ? "Dubai, UAE" : "Mumbai, India",
  }));
};

// ─── UTILS: NUMBER FORMATTING ───
const nFormat = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
};

// ─── COMPONENT: COMMENTS DRAWER (EXTENDED) ───
const CommentsDrawer = ({
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
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="absolute bottom-0 left-0 right-0 h-[75%] z-[100] bg-[#1a1a1a] rounded-t-[32px] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10"
    >
      <div
        className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-4 mb-2 cursor-pointer"
        onClick={onClose}
      />
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
        <h3 className="text-white font-extrabold text-base">
          Comments <span className="text-zinc-500 font-normal ml-1">1,240</span>
        </h3>
        <button
          onClick={onClose}
          className="hover:bg-white/10 p-2 rounded-full transition-colors text-white"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-7 custom-scrollbar">
        {Array.from({ length: 15 }).map((_, idx) => (
          <div key={idx} className="flex gap-4 group">
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${idx + flickId}`}
              className="w-10 h-10 rounded-full bg-zinc-800"
              alt="user"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-zinc-400 text-xs font-bold">
                  @dev_reviewer_{idx}
                </p>
                <span className="text-[10px] text-zinc-600">4h ago</span>
              </div>
              <p className="text-zinc-100 text-sm mt-1 leading-relaxed">
                Bhai iska "Source Code" mil sakta hai kya? Animation bahut
                smooth hai! ⚡️🔥
              </p>
              <div className="flex gap-5 mt-3 text-zinc-500 text-[11px] font-semibold">
                <button className="hover:text-white transition-colors">
                  Reply
                </button>
                <button className="hover:text-white transition-colors">
                  See translation
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 text-zinc-600 mt-1">
              <Heart
                size={16}
                className="group-hover:text-red-500 cursor-pointer transition-colors"
              />
              <span className="text-[10px]">42</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 bg-[#222] flex gap-3 items-center border-t border-white/5 pb-10">
        <img
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=you"
          className="w-9 h-9 rounded-full border border-purple-500/50"
        />
        <div className="relative flex-1">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment for @creator..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600"
          />
          <button
            className={`absolute right-3 top-1/2 -translate-y-1/2 font-bold text-sm ${commentText ? "text-blue-500" : "text-zinc-700"}`}
          >
            Post
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── COMPONENT: FLICK CARD (INDIVIDUAL VIDEO) ───
const FlickCard = memo(
  ({
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
    const [showHeart, setShowHeart] = useState(false);
    const [liked, setLiked] = useState(false);
    const lastTap = useRef(0);

    useEffect(() => {
      if (isActive && videoRef.current) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => setIsPlaying(false));
        }
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
    }, [isActive]);

    const handleGesture = (e: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setLiked(true);
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 1000);
      } else {
        if (videoRef.current) {
          if (isPlaying) videoRef.current.pause();
          else videoRef.current.play();
          setIsPlaying(!isPlaying);
        }
      }
      lastTap.current = now;
    };

    return (
      <div
        className="relative w-full h-full bg-black select-none overflow-hidden touch-none"
        onClick={handleGesture}
      >
        {/* Video Canvas */}
        <video
          ref={videoRef}
          src={item.videoUrl}
          loop
          muted={isMuted}
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Overlays & Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none z-10" />

        {/* Double Tap Heart */}
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0, rotate: -20 }}
              animate={{ scale: 1.8, opacity: 1, rotate: 0 }}
              exit={{ scale: 3, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
            >
              <Heart
                size={110}
                fill="#ff2d55"
                className="text-[#ff2d55] filter drop-shadow-[0_0_20px_rgba(255,45,85,0.8)]"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Bar UI */}
        <div className="absolute top-12 left-0 right-0 px-6 flex justify-between items-center z-30">
          <div className="flex gap-6 text-white font-black text-base uppercase tracking-widest">
            <span className="opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
              Friends
            </span>
            <span className="border-b-4 border-white pb-1 shadow-lg">
              For You
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-white">
              <Flag size={20} className="opacity-70" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="bg-black/30 backdrop-blur-xl p-2.5 rounded-full text-white border border-white/10 hover:scale-110 transition-transform"
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
        </div>

        {/* Play Icon Placeholder */}
        {!isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-full border border-white/20">
              <Play
                size={60}
                fill="white"
                className="text-white opacity-80 ml-2"
              />
            </div>
          </motion.div>
        )}

        {/* Right Interaction Sidebar */}
        <div className="absolute right-4 bottom-24 flex flex-col items-center gap-7 z-30">
          <div className="relative group">
            <div className="w-14 h-14 rounded-full border-2 border-white shadow-xl overflow-hidden transform group-active:scale-90 transition-transform">
              <img
                src={item.avatar}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <motion.div
              whileTap={{ scale: 0.7 }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ff2d55] rounded-full p-1 border-2 border-black cursor-pointer"
            >
              <Plus size={14} className="text-white font-bold" />
            </motion.div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setLiked(!liked);
              }}
              whileTap={{ scale: 0.6 }}
              className="group"
            >
              <Heart
                size={38}
                fill={liked ? "#ff2d55" : "none"}
                className={`${liked ? "text-[#ff2d55]" : "text-white"} filter drop-shadow-lg transition-colors`}
              />
            </motion.button>
            <span className="text-white text-xs font-black drop-shadow-md">
              {nFormat(item.likes)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onOpenComments();
              }}
              whileTap={{ scale: 0.8 }}
              className="text-white hover:text-blue-400 transition-colors"
            >
              <MessageCircle size={38} className="filter drop-shadow-lg" />
            </motion.button>
            <span className="text-white text-xs font-black drop-shadow-md">
              {nFormat(item.comments)}
            </span>
          </div>

          <motion.button whileTap={{ scale: 0.8 }} className="text-white group">
            <Bookmark
              size={34}
              className="group-active:text-yellow-400 transition-colors"
            />
          </motion.button>

          <motion.button whileTap={{ scale: 0.8 }} className="text-white">
            <Share2 size={34} />
          </motion.button>

          <motion.div
            animate={isActive ? { rotate: 360 } : {}}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="w-12 h-12 rounded-full border-[6px] border-zinc-800 bg-gradient-to-tr from-zinc-900 to-black flex items-center justify-center shadow-2xl relative"
          >
            <Music size={16} className="text-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black" />
          </motion.div>
        </div>

        {/* Bottom Information Section */}
        <div className="absolute bottom-10 left-5 right-24 text-white z-30">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-black text-xl flex items-center gap-1.5 tracking-tight group cursor-pointer">
              @{item.username}{" "}
              <Check
                size={16}
                className="bg-blue-500 text-white rounded-full p-0.5 shadow-blue-500/50 shadow-lg"
              />
            </h3>
            <button className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-md text-[10px] font-black border border-white/10 hover:bg-white/20 transition-all">
              Follow
            </button>
          </div>

          {item.location && (
            <p className="text-[10px] text-zinc-300 font-bold mb-2 flex items-center gap-1 opacity-80 italic">
              📍 {item.location}
            </p>
          )}

          <p className="text-sm font-medium leading-relaxed mb-4 line-clamp-3 text-zinc-100 drop-shadow-md">
            {item.caption} <br />
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="font-black text-blue-400 mr-2 hover:underline cursor-pointer shadow-sm"
              >
                {tag}
              </span>
            ))}
          </p>

          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md w-fit px-4 py-2 rounded-xl border border-white/10 shadow-xl overflow-hidden">
            <Music size={14} className="animate-pulse text-purple-400" />
            <div className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden w-36 relative">
              <motion.p
                animate={{ x: [150, -200] }}
                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
              >
                {item.song} — Featuring DJ Dev
              </motion.p>
            </div>
          </div>
        </div>

        {/* Progress Track */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-40">
          <motion.div
            initial={{ width: "0%" }}
            animate={isActive ? { width: "100%" } : { width: "0%" }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500 shadow-[0_0_15px_rgba(255,255,255,0.6)]"
          />
        </div>
      </div>
    );
  },
);

// ─── MAIN FEED ENGINE (ORCHESTRATOR) ───
export default function FlicksMasterFeed() {
  const [flicks] = useState<FlickItem[]>(generateFlicks());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (showComments) return;
      if (e.key === "ArrowDown" && currentIndex < flicks.length - 1)
        setCurrentIndex((p) => p + 1);
      if (e.key === "ArrowUp" && currentIndex > 0)
        setCurrentIndex((p) => p - 1);
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [currentIndex, showComments, flicks.length]);

  const handleSwipe = (_: any, info: PanInfo) => {
    if (showComments) return;
    const threshold = 80;
    if (info.offset.y < -threshold && currentIndex < flicks.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (info.offset.y > threshold && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#000] flex justify-center items-center font-sans overflow-hidden">
      {/* Dynamic Main App Container */}
      <div className="relative w-full max-w-[520px] h-full bg-[#0a0a0a] shadow-[0_0_100px_rgba(0,0,0,0.8)] border-x border-white/5">
        {/* Core Scrolling Architecture */}
        <div
          className="h-full w-full overflow-hidden relative"
          ref={containerRef}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentIndex}
              drag={showComments ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={handleSwipe}
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0.5 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 180,
                mass: 0.8,
              }}
              className="absolute inset-0 z-10"
            >
              <FlickCard
                item={flicks[currentIndex]}
                isActive={true}
                onOpenComments={() => setShowComments(true)}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Overlays */}
        <AnimatePresence>
          {showComments && (
            <CommentsDrawer
              flickId={flicks[currentIndex].id}
              onClose={() => setShowComments(false)}
            />
          )}
        </AnimatePresence>

        {/* Navigation Dots (Right Sidebar Indicators) */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: i === currentIndex % 12 ? 28 : 6,
                backgroundColor:
                  i === currentIndex % 12 ? "#ffffff" : "rgba(255,255,255,0.2)",
              }}
              className="w-1.5 rounded-full transition-all duration-500"
            />
          ))}
        </div>

        {/* Bottom Global Navbar (Visual Only) */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-around px-10 z-[60] border-t border-white/5 backdrop-blur-sm">
          <button className="text-white/40 hover:text-white transition-colors">
            <ShoppingBag size={26} />
          </button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="bg-white p-2 rounded-xl text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            <Plus size={28} />
          </motion.button>
          <button className="text-white/40 hover:text-white transition-colors">
            <UserPlus size={26} />
          </button>
        </div>
      </div>
    </div>
  );
}
