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

const STYLE_ID = "gol-nav-styles";
function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes cyan-arrow-pulse {
      0%   { color: #00e5ff; filter: drop-shadow(0 0 5px rgba(0,229,255,0.8)); }
      50%  { color: #67e8f9; filter: drop-shadow(0 0 10px rgba(103,232,249,0.9)); }
      100% { color: #00e5ff; filter: drop-shadow(0 0 5px rgba(0,229,255,0.8)); }
    }
    @keyframes handle-cyan-glow {
      0%   { box-shadow: 0 -3px 20px rgba(0,229,255,0.12); }
      50%  { box-shadow: 0 -3px 28px rgba(0,229,255,0.28); }
      100% { box-shadow: 0 -3px 20px rgba(0,229,255,0.12); }
    }
    @keyframes tab-underline-glow {
      0%   { box-shadow: 0 2px 8px rgba(0,229,255,0.55); }
      50%  { box-shadow: 0 2px 14px rgba(0,229,255,0.9); }
      100% { box-shadow: 0 2px 8px rgba(0,229,255,0.55); }
    }
  `;
  document.head.appendChild(s);
}

const CYAN     = "#00e5ff";
const CYAN_DIM = "rgba(0,229,255,0.55)";
const BG_DARK  = "#0b0d12";
const BG_TRAY  = "rgba(11,13,18,0.96)";

const GolSlider = ({ onFeatureChange, activeFeature, hidden }: GolSliderProps) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => { injectKeyframes(); }, []);

  if (hidden) return null;

  return (
    <div
      className="fixed bottom-0 left-0 w-full z-[200] flex flex-col"
      style={{ pointerEvents: "none" }}
    >
      {/* ── TRAY ─────────────────────────────────────────────────────────────── */}
      <div
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 480ms cubic-bezier(0.4, 0, 0.2, 1)",
          background: BG_TRAY,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: `1px solid ${CYAN_DIM}`,
          willChange: "transform",
          pointerEvents: "auto",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div
          className="flex items-stretch max-w-lg mx-auto w-full"
          style={{ height: 72 }}
        >
          {NAV_ITEMS.map(({ label, feature, Icon }, idx) => {
            const isActive = activeFeature === feature;
            const isLast   = idx === NAV_ITEMS.length - 1;
            return (
              <button
                key={feature}
                onClick={() => {
                  onFeatureChange?.(feature);
                  setIsOpen(false);
                }}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: isActive ? "rgba(0,229,255,0.07)" : "transparent",
                  borderRadius: 0,
                  border: "none",
                  borderRight: isLast ? "none" : `1px solid rgba(0,229,255,0.1)`,
                  borderBottom: isActive ? `2px solid ${CYAN}` : "2px solid transparent",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 200ms ease, border-color 200ms ease",
                  animation: isActive ? "tab-underline-glow 1.8s ease-in-out infinite" : "none",
                }}
                className="active:scale-95"
              >
                {/* Halo glow behind active icon */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -60%)",
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(0,229,255,0.22) 0%, transparent 70%)",
                      pointerEvents: "none",
                    }}
                  />
                )}

                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.4 : 1.6}
                  style={{
                    color: isActive ? CYAN : "rgba(255,255,255,0.38)",
                    filter: isActive
                      ? "drop-shadow(0 0 7px rgba(0,229,255,0.95)) drop-shadow(0 0 14px rgba(0,229,255,0.5))"
                      : "none",
                    transition: "color 200ms ease, filter 200ms ease",
                    position: "relative",
                    zIndex: 1,
                  }}
                />

                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    lineHeight: 1,
                    color: isActive ? CYAN : "rgba(255,255,255,0.28)",
                    textShadow: isActive ? `0 0 8px rgba(0,229,255,0.8)` : "none",
                    transition: "color 200ms ease, text-shadow 200ms ease",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── HANDLE ───────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((p) => !p)}
        style={{
          pointerEvents: "auto",
          background: BG_DARK,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: `1px solid ${CYAN_DIM}`,
          width: "100%",
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          cursor: "pointer",
          animation: "handle-cyan-glow 2s ease-in-out infinite",
          transition: "background 300ms ease",
          border: "none",
          borderTop: `1px solid ${CYAN_DIM}`,
        }}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        <span
          style={{
            width: 22,
            height: 1,
            background: `rgba(0,229,255,0.3)`,
          }}
        />
        {isOpen ? (
          <ChevronDown
            size={16}
            strokeWidth={3}
            style={{ animation: "cyan-arrow-pulse 1.6s ease-in-out infinite" }}
          />
        ) : (
          <ChevronUp
            size={16}
            strokeWidth={3}
            style={{ animation: "cyan-arrow-pulse 1.6s ease-in-out infinite" }}
          />
        )}
        <span
          style={{
            width: 22,
            height: 1,
            background: `rgba(0,229,255,0.3)`,
          }}
        />
      </button>
    </div>
  );
};

export default GolSlider;
