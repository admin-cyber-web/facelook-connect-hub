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
  Home,
} from "lucide-react";

const FEATURES = [
  { label: "Fame",     icon: Star,        displayLabel: "Home"     },
  { label: "Flicks",   icon: Film,        displayLabel: "Flicks"   },
  { label: "Flame",    icon: Flame,       displayLabel: "Flame"    },
  { label: "Face",     icon: User,        displayLabel: "Face"     },
  { label: "Snapy",    icon: Camera,      displayLabel: "Snapy"    },
  { label: "Task",     icon: CheckSquare, displayLabel: "Task"     },
  { label: "Fun",      icon: Smile,       displayLabel: "Fun"      },
  { label: "Film",     icon: Clapperboard,displayLabel: "Film"     },
  { label: "Settings", icon: Settings,    displayLabel: "Function" },
];

const GolSlider = ({
  onFeatureChange,
}: {
  onFeatureChange?: (feature: string) => void;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const dragStartX = useRef(0);
  const isDragging = useRef(false);

  const goTo = (index: number, dir: number) => {
    setDirection(dir);
    setActiveIndex(index);
    onFeatureChange?.(FEATURES[index].label);
  };

  const handlePanEnd = (_: any, info: PanInfo) => {
    const THRESHOLD = 40;
    if (Math.abs(info.offset.x) < THRESHOLD) {
      isDragging.current = false;
      return;
    }
    isDragging.current = true;
    if (info.offset.x < -THRESHOLD) {
      // Swipe left → next
      const next = (activeIndex + 1) % FEATURES.length;
      goTo(next, 1);
    } else {
      // Swipe right → prev
      const prev = (activeIndex - 1 + FEATURES.length) % FEATURES.length;
      goTo(prev, -1);
    }
  };

  const handleTap = () => {
    if (isDragging.current) {
      isDragging.current = false;
      return;
    }
    // Tap cycles forward (same as swipe-left)
    const next = (activeIndex + 1) % FEATURES.length;
    goTo(next, 1);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    goTo(0, -1);
  };

  const current = FEATURES[activeIndex];
  const ActiveIcon = current.icon;
  const isHome = activeIndex === 0;

  // Rolling variants: icon rolls in/out horizontally like a marble
  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 40 : -40,
      rotateY: dir > 0 ? 90 : -90,
      opacity: 0,
    }),
    center: {
      x: 0,
      rotateY: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -40 : 40,
      rotateY: dir > 0 ? -90 : 90,
      opacity: 0,
    }),
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Close / Back-to-Home bubble */}
      <AnimatePresence>
        {!isHome && (
          <motion.button
            key="close-btn"
            initial={{ opacity: 0, y: 10, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full select-none"
            style={{
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            }}
          >
            <Home size={12} className="text-white/80" strokeWidth={2.5} />
            <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">
              Home
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Master Glass Orb */}
      <div className="relative">
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onPanEnd={handlePanEnd}
          onClick={handleTap}
          whileTap={{ scale: 0.9 }}
          whileDrag={{ scale: 0.95 }}
          className="relative w-[88px] h-[88px] rounded-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
          style={{
            background:
              "radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.04) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1.5px solid rgba(255,255,255,0.30)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.40), inset 0 1.5px 0 rgba(255,255,255,0.40), inset 0 -1.5px 0 rgba(0,0,0,0.15)",
            perspective: "400px",
          }}
        >
          {/* Top specular highlight (3D glass shine) */}
          <div
            className="absolute top-[9px] left-[17px] w-[30px] h-[15px] rounded-full pointer-events-none z-20"
            style={{
              background:
                "radial-gradient(ellipse, rgba(255,255,255,0.60) 0%, transparent 80%)",
              filter: "blur(3px)",
            }}
          />

          {/* Bottom rim glow */}
          <div
            className="absolute bottom-[7px] right-[12px] w-[22px] h-[11px] rounded-full pointer-events-none z-20"
            style={{
              background:
                "radial-gradient(ellipse, rgba(255,255,255,0.20) 0%, transparent 80%)",
              filter: "blur(4px)",
            }}
          />

          {/* Rolling icon + label */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 30,
                opacity: { duration: 0.12 },
              }}
              className="flex flex-col items-center gap-[4px] relative z-10"
              style={{ transformStyle: "preserve-3d" }}
            >
              <ActiveIcon
                size={22}
                className="text-white drop-shadow-[0_1px_5px_rgba(0,0,0,0.5)]"
                strokeWidth={2}
              />
              <span className="text-[9px] font-black text-white/90 uppercase tracking-[0.15em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                {current.displayLabel}
              </span>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Swipe hint arrows — subtle, fade out after first swipe */}
        <AnimatePresence>
          {isHome && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-y-0 -left-5 -right-5 flex items-center justify-between pointer-events-none"
            >
              <span className="text-white/20 text-[10px] font-black">‹</span>
              <span className="text-white/20 text-[10px] font-black">›</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GolSlider;
