import { useState } from "react";
import { Film, Anchor, CheckSquare, Users, Camera, ChevronLeft, ChevronRight } from "lucide-react";

const NAV_ITEMS = [
  { label: "Flicks", feature: "Flicks", Icon: Film       },
  { label: "Hooks",  feature: "Hooks",  Icon: Anchor     },
  { label: "Task",   feature: "Task",   Icon: CheckSquare },
  { label: "Circle", feature: "Circle", Icon: Users      },
  { label: "Snapy",  feature: "Snapy",  Icon: Camera     },
] as const;

interface GolSliderProps {
  onFeatureChange?: (feature: string) => void;
  activeFeature?: string;
}

const GolSlider = ({ onFeatureChange, activeFeature }: GolSliderProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="fixed right-0 z-[200] flex flex-row items-center"
      style={{ top: "50%", transform: "translateY(-50%)" }}
    >
      {/* ── TRAY ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)",
          background: "rgba(15, 23, 42, 0.72)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRight: "none",
          borderRadius: "20px 0 0 20px",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.35), inset 1px 0 0 rgba(255,255,255,0.06)",
          willChange: "transform",
        }}
        className="flex flex-col items-center py-4 gap-1"
      >
        {NAV_ITEMS.map(({ label, feature, Icon }) => {
          const isActive = activeFeature === feature;
          return (
            <button
              key={feature}
              onClick={() => {
                onFeatureChange?.(feature);
                setIsOpen(false);
              }}
              style={{
                background: isActive
                  ? "rgba(59,130,246,0.25)"
                  : "transparent",
                borderRadius: 14,
                border: isActive
                  ? "1px solid rgba(59,130,246,0.4)"
                  : "1px solid transparent",
                transition: "all 220ms ease",
              }}
              className="flex flex-col items-center justify-center gap-1.5 w-16 py-3 mx-2 active:scale-90"
            >
              <Icon
                size={26}
                style={{
                  color: isActive ? "#60a5fa" : "rgba(255,255,255,0.55)",
                  filter: isActive ? "drop-shadow(0 0 6px rgba(96,165,250,0.7))" : "none",
                  transition: "all 220ms ease",
                }}
                strokeWidth={isActive ? 2.2 : 1.6}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  lineHeight: 1,
                  color: isActive ? "#93c5fd" : "rgba(255,255,255,0.40)",
                  transition: "color 220ms ease",
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── HANDLE ────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          background: isOpen
            ? "rgba(59,130,246,0.18)"
            : "rgba(15, 23, 42, 0.80)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderLeft: isOpen ? "1px solid rgba(59,130,246,0.25)" : "1px solid rgba(255,255,255,0.14)",
          borderRadius: "0 14px 14px 0",
          boxShadow: "4px 0 20px rgba(0,0,0,0.30), inset -1px 0 0 rgba(255,255,255,0.06)",
          width: 28,
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 300ms ease, border-color 300ms ease",
          cursor: "pointer",
        }}
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
      >
        {isOpen ? (
          <ChevronRight
            size={16}
            style={{ color: "#93c5fd", transition: "color 300ms ease" }}
            strokeWidth={2.5}
          />
        ) : (
          <ChevronLeft
            size={16}
            style={{ color: "rgba(255,255,255,0.6)", transition: "color 300ms ease" }}
            strokeWidth={2.5}
          />
        )}
      </button>
    </div>
  );
};

export default GolSlider;
