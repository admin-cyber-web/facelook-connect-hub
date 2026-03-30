import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Music,
  Play,
  Pause,
  ThumbsUp,
  Bookmark,
  X,
  Send,
} from "lucide-react";

// --- Interfaces ---
interface FlickItem {
  id: number;
  author: string;
  initials: string;
  gradient: string;
  caption: string;
  song: string;
  likes: string;
  comments: string;
  shares: string;
  bgGradient: string;
  emoji: string;
}

interface Comment {
  id: number;
  author: string;
  initials: string;
  gradient: string;
  text: string;
  time: string;
  likes: number;
  liked: boolean;
}

// --- Data Generation (50 Items) ---
const FLICKS: FlickItem[] = Array.from({ length: 50 }).map((_, i) => {
  const authors = [
    "Ayesha.creates",
    "zain.vibes",
    "sara.cooks",
    "ali.explores",
    "hira.designs",
  ];
  const emojis = ["💻", "🌅", "🍳", "🏔️", "🎨", "🚀", "🍕", "🎮", "🎸", "🐶"];
  const bgGradients = [
    "from-violet-500/30 via-fuchsia-500/20 to-pink-500/30",
    "from-orange-400/30 via-rose-400/20 to-purple-500/30",
    "from-amber-400/30 via-yellow-300/20 to-orange-500/30",
    "from-emerald-400/30 via-teal-400/20 to-cyan-500/30",
    "from-blue-400/30 via-indigo-400/20 to-violet-500/30",
  ];

  return {
    id: i + 1,
    author: authors[i % authors.length],
    initials: authors[i % authors.length].substring(0, 2).toUpperCase(),
    gradient: `bg-gradient-to-br from-primary to-secondary`,
    caption: `Flick #${i + 1}: Enjoying the vibe! ✨ #Viral #Trending #${authors[i % authors.length].replace(".", "")}`,
    song: `♪ Original Audio — ${authors[i % authors.length]}`,
    likes: `${(Math.random() * 100).toFixed(1)}K`,
    comments: `${Math.floor(Math.random() * 5000)}`,
    shares: `${Math.floor(Math.random() * 2000)}`,
    bgGradient: bgGradients[i % bgGradients.length],
    emoji: emojis[i % emojis.length],
  };
});

// Mock Comments for all 50 items
const MOCK_COMMENTS: Record<number, Comment[]> = {};
FLICKS.forEach((f) => {
  MOCK_COMMENTS[f.id] = [
    {
      id: 1,
      author: "user_one",
      initials: "U1",
      gradient: "bg-blue-500",
      text: "Amazing view! 🔥",
      time: "1h",
      likes: 12,
      liked: false,
    },
    {
      id: 2,
      author: "coder_123",
      initials: "C1",
      gradient: "bg-purple-500",
      text: "Love this style ✨",
      time: "30m",
      likes: 5,
      liked: false,
    },
  ];
});

/* ─── Comments Drawer ─── */
const CommentsDrawer = ({
  flickId,
  onClose,
}: {
  flickId: number;
  onClose: () => void;
}) => {
  const [comments, setComments] = useState<Comment[]>(
    MOCK_COMMENTS[flickId] || [],
  );
  const [newComment, setNewComment] = useState("");

  const handleSend = () => {
    if (!newComment.trim()) return;
    setComments((prev) => [
      {
        id: Date.now(),
        author: "you",
        initials: "U",
        gradient: "bg-gradient-to-br from-primary to-accent",
        text: newComment.trim(),
        time: "now",
        likes: 0,
        liked: false,
      },
      ...prev,
    ]);
    setNewComment("");
  };

  const toggleLike = (id: number) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              liked: !c.liked,
              likes: c.liked ? c.likes - 1 : c.likes + 1,
            }
          : c,
      ),
    );
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 z-40"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80) onClose();
        }}
        className="absolute bottom-0 left-0 right-0 h-[65%] z-50 bg-white dark:bg-zinc-900 rounded-t-2xl flex flex-col"
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="px-4 py-2 border-b flex justify-between items-center font-bold">
          <span>{comments.length} Comments</span>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div
                className={`w-8 h-8 rounded-full ${c.gradient} flex items-center justify-center text-[10px] text-white font-bold`}
              >
                {c.initials}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold">@{c.author}</p>
                <p className="text-xs">{c.text}</p>
              </div>
              <button
                onClick={() => toggleLike(c.id)}
                className="flex flex-col items-center"
              >
                <Heart
                  size={14}
                  fill={c.liked ? "red" : "none"}
                  className={c.liked ? "text-red-500" : ""}
                />{" "}
                <span className="text-[10px]">{c.likes}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add comment..."
            className="flex-1 bg-gray-100 dark:bg-zinc-800 p-2 rounded-full text-sm outline-none"
          />
          <button onClick={handleSend} className="text-blue-500">
            <Send size={20} />
          </button>
        </div>
      </motion.div>
    </>
  );
};

/* ─── Flick Card ─── */
const FlickCard = ({
  flick,
  isActive,
  onOpenComments,
}: {
  flick: FlickItem;
  isActive: boolean;
  onOpenComments: () => void;
}) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const lastTap = useRef(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setLiked(true);
      setDoubleTapHeart(true);
      setTimeout(() => setDoubleTapHeart(false), 800);
    }
    lastTap.current = now;
  };

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black"
      onClick={handleDoubleTap}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-b ${flick.bgGradient}`}
      />
      <motion.div
        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
        className="text-9xl z-10"
      >
        {flick.emoji}
      </motion.div>

      <AnimatePresence>
        {doubleTapHeart && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1.5 }}
            exit={{ scale: 2, opacity: 0 }}
            className="absolute z-30 pointer-events-none"
          >
            <Heart size={100} fill="red" className="text-red-500" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-20">
        <div className="flex flex-col items-center">
          <div
            className={`w-12 h-12 rounded-full border-2 border-white ${flick.gradient} flex items-center justify-center font-bold text-white`}
          >
            {flick.initials}
          </div>
          <div className="bg-red-500 rounded-full w-5 h-5 flex items-center justify-center -mt-3 text-white text-xs">
            +
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setLiked(!liked);
          }}
          className="flex flex-col items-center"
        >
          <Heart
            size={32}
            fill={liked ? "red" : "none"}
            className={liked ? "text-red-500" : "text-white"}
          />
          <span className="text-white text-xs">{flick.likes}</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments();
          }}
          className="flex flex-col items-center"
        >
          <MessageCircle size={32} className="text-white" />
          <span className="text-white text-xs">{flick.comments}</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSaved(!saved);
          }}
        >
          <Bookmark
            size={32}
            fill={saved ? "gold" : "none"}
            className={saved ? "text-yellow-400" : "text-white"}
          />
        </button>
        <Share2 size={32} className="text-white" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-600"
        >
          <Music size={16} className="text-white" />
        </motion.div>
      </div>

      <div className="absolute bottom-8 left-4 right-20 text-white z-20">
        <h3 className="font-bold mb-1">@{flick.author}</h3>
        <p className="text-sm mb-2">{flick.caption}</p>
        <div className="flex items-center gap-2 overflow-hidden w-40">
          <Music size={14} />
          <motion.p
            animate={{ x: [100, -150] }}
            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            className="whitespace-nowrap text-xs"
          >
            {flick.song}
          </motion.p>
        </div>
      </div>
    </div>
  );
};

/* ─── Flicks Feed (Main) ─── */
const FlicksFeed = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < FLICKS.length) {
      setCurrentIndex(index);
      setCommentsOpen(false);
    }
  }, []);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (commentsOpen) return;
    if (info.offset.y < -50) goTo(currentIndex + 1);
    else if (info.offset.y > 50) goTo(currentIndex - 1);
  };

  return (
    <div className="fixed inset-0 bg-black flex justify-center items-center">
      {/* Mobile Container aspect ratio */}
      <div className="relative w-full max-w-[450px] h-full bg-zinc-900 overflow-hidden shadow-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            drag={commentsOpen ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={handleDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            className="absolute inset-0"
          >
            <FlickCard
              flick={FLICKS[currentIndex]}
              isActive={true}
              onOpenComments={() => setCommentsOpen(true)}
            />
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {commentsOpen && (
            <CommentsDrawer
              flickId={FLICKS[currentIndex].id}
              onClose={() => setCommentsOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Pagination Indicators */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30">
          {FLICKS.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map(
            (f) => (
              <div
                key={f.id}
                className={`w-1.5 rounded-full transition-all ${f.id === currentIndex + 1 ? "h-6 bg-white" : "h-1.5 bg-white/40"}`}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
};

export default FlicksFeed;
