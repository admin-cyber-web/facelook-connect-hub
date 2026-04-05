import { motion } from "framer-motion";
import { Film, Smile, CheckSquare, Flame, Camera } from "lucide-react";

const NAV_ITEMS = [
  { label: "Flicks", feature: "Flicks", Icon: Film  },
  { label: "Fun",    feature: "Fun",    Icon: Smile },
  { label: "Task",   feature: "Task",   Icon: CheckSquare },
  { label: "Flame",  feature: "Flame",  Icon: Flame },
  { label: "Snapy",  feature: "Snapy",  Icon: Camera },
] as const;

interface GolSliderProps {
  onFeatureChange?: (feature: string) => void;
  activeFeature?: string;
}

const GolSlider = ({ onFeatureChange, activeFeature }: GolSliderProps) => {
  return (
    <div
      className="flex items-center justify-around w-full"
      style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(0,0,0,0.09)",
        paddingTop: "8px",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
      }}
    >
      {NAV_ITEMS.map(({ label, feature, Icon }) => {
        const isActive = activeFeature === feature;

        return (
          <motion.button
            key={feature}
            whileTap={{ scale: 0.88 }}
            onClick={() => onFeatureChange?.(feature)}
            className="flex flex-col items-center justify-center gap-[3px] px-4 py-1.5 rounded-xl relative"
          >
            {/* Active indicator pill */}
            {isActive && (
              <motion.div
                layoutId="nav-active-pill"
                className="absolute inset-0 rounded-xl"
                style={{ background: "rgba(37,99,235,0.08)" }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}

            <Icon
              size={22}
              className={isActive ? "text-blue-600" : "text-gray-400"}
              fill={isActive ? "currentColor" : "none"}
              strokeWidth={isActive ? 0 : 1.8}
              style={{ position: "relative", zIndex: 1 }}
            />
            <span
              className={`text-[10px] font-black tracking-tight leading-none relative z-10 ${
                isActive ? "text-blue-600" : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default GolSlider;
