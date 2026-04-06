import { useState, useEffect } from "react";
import { Film, Anchor, CheckSquare, Users, Camera, ChevronUp, ChevronDown } from "lucide-react";

const NAV_ITEMS = [
  { label: "Flicks", feature: "Flicks", Icon: Film        },
  { label: "Hooks",  feature: "Hooks",  Icon: Anchor      },
  { label: "Task",   feature: "Task",   Icon: CheckSquare },
  { label: "Circle", feature: "Circle", Icon: Users       },
  { label: "Snapy",  feature: "Snapy",  Icon: Camera      },
] as const;

interface GolSliderProps {
  onFeatureChange?: (feature: string) => void;
  activeFeature?: string;
  hidden?: boolean;
}

const STYLE_ID = "gol-arrow-pulse";
function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes arrow-redblue {
      0%   { color: #ef4444; text-shadow: 0 0 8px #ef4444aa; }
      50%  { color: #3b82f6; text-shadow: 0 0 8px #3b82f6aa; }
      100% { color: #ef4444; text-shadow: 0 0 8px #ef4444aa; }
    }
    @keyframes handle-glow {
      0%   { box-shadow: 0 -4px 18px rgba(239,68,68,0.35); }
      50%  { box-shadow: 0 -4px 18px rgba(59,130,246,0.45); }
      100% { box-shadow: 0 -4px 18px rgba(239,68,68,0.35); }
    }
  `;
  document.head.appendChild(s);
}

const GolSlider = ({ onFeatureChange, activeFeature, hidden }: GolSliderProps) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => { injectKeyframes(); }, []);

  if (hidden) return null;

  return (
    <div
      className="fixed bottom-0 left-0 w-full z-[200] flex flex-col"
      style={{ pointerEvents: "none" }}
    >
      {/* ── TRAY ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)",
          background: "rgba(10, 15, 30, 0.82)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          borderTop: "1px solid rgba(255,255,255,0.10)",
          willChange: "transform",
          pointerEvents: "auto",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-center justify-around px-2 py-3 max-w-lg mx-auto w-full">
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
                  background: isActive ? "rgba(59,130,246,0.20)" : "transparent",
                  borderRadius: 16,
                  border: isActive ? "1px solid rgba(59,130,246,0.35)" : "1px solid transparent",
                  transition: "all 220ms ease",
                  flex: 1,
                }}
                className="flex flex-col items-center justify-center gap-1.5 py-2.5 mx-1 active:scale-90"
              >
                <Icon
                  size={24}
                  style={{
                    color: isActive ? "#60a5fa" : "rgba(255,255,255,0.50)",
                    filter: isActive ? "drop-shadow(0 0 6px rgba(96,165,250,0.75))" : "none",
                    transition: "all 220ms ease",
                  }}
                  strokeWidth={isActive ? 2.2 : 1.6}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.05em",
                    lineHeight: 1,
                    color: isActive ? "#93c5fd" : "rgba(255,255,255,0.35)",
                    transition: "color 220ms ease",
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── HANDLE ────────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((p) => !p)}
        style={{
          pointerEvents: "auto",
          background: "rgba(10, 15, 30, 0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.10)",
          width: "100%",
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: "pointer",
          animation: "handle-glow 1.4s ease-in-out infinite",
          transition: "background 300ms ease",
        }}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        <span style={{ width: 20, height: 2, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        {isOpen ? (
          <ChevronDown size={18} strokeWidth={2.8} style={{ animation: "arrow-redblue 1.4s ease-in-out infinite" }} />
        ) : (
          <ChevronUp size={18} strokeWidth={2.8} style={{ animation: "arrow-redblue 1.4s ease-in-out infinite" }} />
        )}
        <span style={{ width: 20, height: 2, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
      </button>
    </div>
  );
};

export default GolSlider;
