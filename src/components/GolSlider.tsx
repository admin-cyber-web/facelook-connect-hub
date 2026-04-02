import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const FEATURES = [
  { label: "Fame", icon: Star },
  { label: "Flicks", icon: Film },
  { label: "Flame", icon: Flame },
  { label: "Face", icon: User },
  { label: "Snapy", icon: Camera },
  { label: "Task", icon: CheckSquare },
  { label: "Fun", icon: Smile },
  { label: "Film", icon: Clapperboard },
  { label: "Settings", icon: Settings, displayLabel: "Function" },
];

const GolSlider = ({
  onFeatureChange,
}: {
  onFeatureChange?: (feature: string) => void;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const handleTap = () => {
    const next = (activeIndex + 1) % FEATURES.length;
    setDirection(1);
    setActiveIndex(next);
    onFeatureChange?.(FEATURES[next].label);
  };

  const current = FEATURES[activeIndex];
  const ActiveIcon = current.icon;
  const label = current.displayLabel || current.label;

  return (
    <div className="flex justify-center">
      <motion.button
        onClick={handleTap}
        whileTap={{ scale: 0.91 }}
        className="relative w-[88px] h-[88px] rounded-full flex items-center justify-center overflow-hidden cursor-pointer select-none"
        style={{
          background:
            "radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.07) 60%, rgba(255,255,255,0.03) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1.5px solid rgba(255,255,255,0.30)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)",
        }}
      >
        {/* Top specular highlight — makes it look like a 3D marble */}
        <div
          className="absolute top-[10px] left-[18px] w-[28px] h-[14px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, transparent 80%)",
            filter: "blur(3px)",
          }}
        />

        {/* Bottom rim light */}
        <div
          className="absolute bottom-[8px] right-[14px] w-[20px] h-[10px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, transparent 80%)",
            filter: "blur(4px)",
          }}
        />

        {/* Sliding content */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeIndex}
            custom={direction}
            initial={{ y: 28 * direction, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -28 * direction, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="flex flex-col items-center gap-[3px] relative z-10"
          >
            <ActiveIcon
              size={22}
              className="text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
              strokeWidth={2}
            />
            <span className="text-[9px] font-black text-white/90 uppercase tracking-[0.15em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
              {label}
            </span>
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default GolSlider;
