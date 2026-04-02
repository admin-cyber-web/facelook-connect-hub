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

  const handleSelect = (i: number) => {
    setActiveIndex(i);
    onFeatureChange?.(FEATURES[i].label);
  };

  return (
    <div className="flex items-center justify-center gap-[7px] px-2">
      {FEATURES.map((feature, i) => {
        const Icon = feature.icon;
        const isActive = i === activeIndex;
        const label = feature.displayLabel || feature.label;

        return (
          <motion.button
            key={feature.label}
            layout
            onClick={() => handleSelect(i)}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={`
              relative flex items-center justify-center overflow-hidden
              h-[46px] rounded-full
              border select-none cursor-pointer
              transition-colors duration-200
              ${
                isActive
                  ? "bg-white/20 border-white/40 shadow-[0_4px_24px_rgba(255,255,255,0.15)]"
                  : "bg-white/[0.08] border-white/[0.15] shadow-[0_2px_12px_rgba(0,0,0,0.25)] hover:bg-white/[0.14]"
              }
            `}
            style={{
              backdropFilter: "blur(15px)",
              WebkitBackdropFilter: "blur(15px)",
              minWidth: "46px",
            }}
            whileTap={{ scale: 0.88 }}
          >
            {/* Glass inner shine */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 60%)",
              }}
            />

            <div className="flex items-center gap-[7px] px-[13px] relative z-10">
              <Icon
                size={17}
                className={
                  isActive ? "text-white" : "text-white/55"
                }
                strokeWidth={isActive ? 2.2 : 1.8}
              />

              <AnimatePresence>
                {isActive && (
                  <motion.span
                    key="label"
                    initial={{ width: 0, opacity: 0, x: -6 }}
                    animate={{ width: "auto", opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: -6 }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 30,
                      opacity: { duration: 0.15 },
                    }}
                    className="text-[11px] font-black text-white uppercase tracking-wider whitespace-nowrap overflow-hidden"
                    style={{ display: "block" }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Active dot glow under icon */}
            {isActive && (
              <motion.div
                layoutId="orb-glow"
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(147,197,253,0.18) 0%, transparent 70%)",
                }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

export default GolSlider;
