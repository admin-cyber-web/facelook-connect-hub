import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Settings,
  Camera,
  Smile,
  Film,
  User,
  Star,
  Flame,
  Clapperboard,
  CheckSquare,
} from "lucide-react";

// प्रोफाइल, ग्रुप और पोस्ट को हटा दिया गया है
// सेटिंग का लेबल 'Function' कर दिया गया है
const FEATURES = [
  { label: "Fame", icon: Star },
  { label: "Flicks", icon: Film },
  { label: "Flame", icon: Flame },
  { label: "Face", icon: User },
  { label: "Snapy", icon: Camera },
  { label: "Task", icon: CheckSquare },
  { label: "Fun", icon: Smile },
  { label: "Film", icon: Clapperboard },
  { label: "Settings", icon: Settings, displayLabel: "Function" }, // ID Settings रहेगी, नाम Function दिखेगा
];

const GolSlider = ({
  onFeatureChange,
}: {
  onFeatureChange?: (feature: string) => void;
}) => {
  const [activeIndex, setActiveIndex] = useState(0); // Fame default (Index 0)
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

  const currentFeature = FEATURES[activeIndex];
  const ActiveIcon = currentFeature.icon;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
      {/* Feature label */}
      <AnimatePresence mode="wait">
        <motion.span
          key={activeIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="text-sm font-black text-blue-600 tracking-widest uppercase bg-white/80 backdrop-blur-md px-4 py-1 rounded-full shadow-sm border border-blue-50"
        >
          {/* यहाँ displayLabel का उपयोग किया है ताकि 'Function' दिखे */}
          {currentFeature.displayLabel || currentFeature.label}
        </motion.span>
      </AnimatePresence>

      {/* Dots indicator */}
      <div className="flex items-center gap-1.5">
        {FEATURES.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-3 h-1.5 bg-blue-600"
                : Math.abs(i - activeIndex) === 1
                  ? "w-1.5 h-1.5 bg-blue-300"
                  : "w-1 h-1 bg-slate-300"
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
        whileTap={{ scale: 0.9 }}
        className="w-[76px] h-[76px] rounded-full bg-white shadow-[0_10px_40px_rgba(37,99,235,0.25)] cursor-grab active:cursor-grabbing flex items-center justify-center border-4 border-white select-none relative overflow-hidden group"
      >
        {/* Subtle inner glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-50 to-transparent opacity-50" />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <ActiveIcon size={30} className="text-blue-600 relative z-10" />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Hint */}
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">
        Slide Identity
      </span>
    </div>
  );
};

export default GolSlider;
