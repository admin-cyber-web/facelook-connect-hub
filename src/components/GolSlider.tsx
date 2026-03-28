import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Pen, CheckSquare, Users, Camera, Smile,
  Film, User, Star, Flame, Clapperboard
} from "lucide-react";

const FEATURES = [
  { label: "Post", icon: Pen },
  { label: "Task", icon: CheckSquare },
  { label: "Groups", icon: Users },
  { label: "Snapy", icon: Camera },
  { label: "Fun", icon: Smile },
  { label: "Flicks", icon: Film },
  { label: "Face", icon: User },
  { label: "Fame", icon: Star },
  { label: "Flame", icon: Flame },
  { label: "Film", icon: Clapperboard },
  { label: "Profile", icon: User },
];

const GolSlider = ({ onFeatureChange }: { onFeatureChange?: (feature: string) => void }) => {
  const [activeIndex, setActiveIndex] = useState(7); // Fame default
  const dragRef = useRef<number>(0);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 40;
    if (info.offset.x < -threshold && activeIndex < FEATURES.length - 1) {
      const next = activeIndex + 1;
      setActiveIndex(next);
      onFeatureChange?.(FEATURES[next].label);
    } else if (info.offset.x > threshold && activeIndex > 0) {
      const next = activeIndex - 1;
      setActiveIndex(next);
      onFeatureChange?.(FEATURES[next].label);
    }
  };

  const ActiveIcon = FEATURES[activeIndex].icon;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
      {/* Feature label */}
      <AnimatePresence mode="wait">
        <motion.span
          key={activeIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="text-sm font-semibold text-foreground/80 tracking-wide uppercase"
        >
          {FEATURES[activeIndex].label}
        </motion.span>
      </AnimatePresence>

      {/* Dots indicator */}
      <div className="flex items-center gap-1.5">
        {FEATURES.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-2.5 h-2.5 bg-primary"
                : Math.abs(i - activeIndex) === 1
                ? "w-1.5 h-1.5 bg-primary/40"
                : "w-1 h-1 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      {/* Main circular button */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.95 }}
        className="w-[72px] h-[72px] rounded-full glass-strong glow-primary animate-pulse-glow cursor-grab active:cursor-grabbing flex items-center justify-center border border-primary/20 select-none"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ActiveIcon size={28} className="text-primary" />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Hint */}
      <span className="text-[10px] text-muted-foreground">← Slide →</span>
    </div>
  );
};

export default GolSlider;
