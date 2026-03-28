import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Heart, MessageCircle, Share2, Music, Play, Pause, ThumbsUp, Bookmark } from "lucide-react";

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

const FLICKS: FlickItem[] = [
  {
    id: 1, author: "Ayesha.creates", initials: "AY",
    gradient: "bg-gradient-to-br from-primary to-secondary",
    caption: "POV: When the code finally works 😭✨ #DevLife #Facelook",
    song: "♪ Levitating — Dua Lipa",
    likes: "42.5K", comments: "1.2K", shares: "890",
    bgGradient: "from-violet-500/30 via-fuchsia-500/20 to-pink-500/30",
    emoji: "💻"
  },
  {
    id: 2, author: "zain.vibes", initials: "ZN",
    gradient: "bg-gradient-to-br from-secondary to-accent",
    caption: "Sunset drive through Islamabad 🌅🚗 This city hits different",
    song: "♪ Blinding Lights — The Weeknd",
    likes: "128K", comments: "3.4K", shares: "2.1K",
    bgGradient: "from-orange-400/30 via-rose-400/20 to-purple-500/30",
    emoji: "🌅"
  },
  {
    id: 3, author: "sara.cooks", initials: "SR",
    gradient: "bg-gradient-to-br from-accent to-primary",
    caption: "Made biryani for the first time and it actually slapped 🍚🔥",
    song: "♪ Heat Waves — Glass Animals",
    likes: "89.2K", comments: "5.6K", shares: "4.3K",
    bgGradient: "from-amber-400/30 via-yellow-300/20 to-orange-500/30",
    emoji: "🍳"
  },
  {
    id: 4, author: "ali.explores", initials: "AL",
    gradient: "bg-gradient-to-br from-primary to-accent",
    caption: "Hunza Valley is absolutely unreal 🏔️ Pakistan is beautiful",
    song: "♪ Dandelions — Ruth B.",
    likes: "256K", comments: "8.9K", shares: "12K",
    bgGradient: "from-emerald-400/30 via-teal-400/20 to-cyan-500/30",
    emoji: "🏔️"
  },
  {
    id: 5, author: "hira.designs", initials: "HR",
    gradient: "bg-gradient-to-br from-secondary to-primary",
    caption: "UI design process from scratch ✨ Glassmorphism is everything",
    song: "♪ As It Was — Harry Styles",
    likes: "67.8K", comments: "2.1K", shares: "1.8K",
    bgGradient: "from-blue-400/30 via-indigo-400/20 to-violet-500/30",
    emoji: "🎨"
  },
];

const FlickCard = ({ flick, isActive }: { flick: FlickItem; isActive: boolean }) => {
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
      className="relative w-full h-full flex items-center justify-center overflow-hidden select-none"
      onClick={handleDoubleTap}
    >
      {/* Video background simulation */}
      <div className={`absolute inset-0 bg-gradient-to-b ${flick.bgGradient}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-foreground/20" />

      {/* Animated emoji content */}
      <motion.div
        animate={isActive ? { scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="text-8xl z-10"
      >
        {flick.emoji}
      </motion.div>

      {/* Double tap heart */}
      <AnimatePresence>
        {doubleTapHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <Heart size={80} className="text-accent" fill="currentColor" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play/Pause indicator */}
      <button
        onClick={(e) => { e.stopPropagation(); setPlaying(!playing); }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
      >
        <AnimatePresence>
          {!playing && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.7 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="w-16 h-16 rounded-full glass-strong flex items-center justify-center"
            >
              <Play size={28} className="text-primary-foreground ml-1" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-20">
        {/* Profile */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-11 h-11 rounded-full ${flick.gradient} flex items-center justify-center text-primary-foreground font-bold text-sm ring-2 ring-primary-foreground`}>
            {flick.initials}
          </div>
          <div className="w-5 h-5 -mt-3 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-[10px] font-bold">+</span>
          </div>
        </div>

        {/* Like */}
        <button onClick={(e) => { e.stopPropagation(); setLiked(!liked); }} className="flex flex-col items-center gap-1">
          <motion.div whileTap={{ scale: 1.3 }}>
            <Heart size={28} className={liked ? "text-accent" : "text-primary-foreground"} fill={liked ? "currentColor" : "none"} />
          </motion.div>
          <span className="text-primary-foreground text-[11px] font-semibold">{flick.likes}</span>
        </button>

        {/* Comment */}
        <button className="flex flex-col items-center gap-1">
          <MessageCircle size={28} className="text-primary-foreground" />
          <span className="text-primary-foreground text-[11px] font-semibold">{flick.comments}</span>
        </button>

        {/* Bookmark */}
        <button onClick={(e) => { e.stopPropagation(); setSaved(!saved); }} className="flex flex-col items-center gap-1">
          <motion.div whileTap={{ scale: 1.3 }}>
            <Bookmark size={26} className={saved ? "text-accent" : "text-primary-foreground"} fill={saved ? "currentColor" : "none"} />
          </motion.div>
        </button>

        {/* Share */}
        <button className="flex flex-col items-center gap-1">
          <Share2 size={26} className="text-primary-foreground" />
          <span className="text-primary-foreground text-[11px] font-semibold">{flick.shares}</span>
        </button>

        {/* Music disc */}
        <motion.div
          animate={isActive && playing ? { rotate: 360 } : {}}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full bg-foreground/80 flex items-center justify-center ring-2 ring-primary-foreground/30"
        >
          <Music size={14} className="text-primary-foreground" />
        </motion.div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-6 left-3 right-16 z-20">
        <p className="text-primary-foreground font-bold text-sm mb-1">@{flick.author}</p>
        <p className="text-primary-foreground/90 text-xs leading-relaxed mb-2">{flick.caption}</p>
        <div className="flex items-center gap-2">
          <Music size={12} className="text-primary-foreground/70" />
          <motion.p
            animate={{ x: [0, -100, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="text-primary-foreground/70 text-[11px]"
          >
            {flick.song}
          </motion.p>
        </div>
      </div>

      {/* Progress bar */}
      {isActive && playing && (
        <motion.div
          className="absolute top-0 left-0 h-[3px] bg-primary-foreground z-30"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 15, ease: "linear" }}
        />
      )}
    </div>
  );
};

const FlicksFeed = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(FLICKS.length - 1, index));
    setCurrentIndex(clamped);
  }, []);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y < -50) goTo(currentIndex + 1);
    else if (info.offset.y > 50) goTo(currentIndex - 1);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") goTo(currentIndex + 1);
      if (e.key === "ArrowUp") goTo(currentIndex - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIndex, goTo]);

  // Mouse wheel
  const wheelTimeout = useRef<NodeJS.Timeout>();
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (wheelTimeout.current) return;
    if (e.deltaY > 30) goTo(currentIndex + 1);
    else if (e.deltaY < -30) goTo(currentIndex - 1);
    wheelTimeout.current = setTimeout(() => { wheelTimeout.current = undefined; }, 600);
  }, [currentIndex, goTo]);

  return (
    <div className="px-4 md:px-8">
      <div
        ref={containerRef}
        className="relative w-full max-w-sm mx-auto aspect-[9/16] rounded-2xl overflow-hidden shadow-xl"
        onWheel={handleWheel}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentIndex}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          >
            <FlickCard flick={FLICKS[currentIndex]} isActive={true} />
          </motion.div>
        </AnimatePresence>

        {/* Swipe hint */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-primary-foreground/50 text-[10px] font-medium text-center"
          >
            {currentIndex < FLICKS.length - 1 ? "↑ Swipe up" : "End of Flicks"}
          </motion.div>
        </div>

        {/* Side dots */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-30">
          {FLICKS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                i === currentIndex ? "w-2 h-4 bg-primary-foreground" : "w-1.5 h-1.5 bg-primary-foreground/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlicksFeed;
