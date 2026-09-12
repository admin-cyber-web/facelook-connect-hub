import { useState, useEffect, useRef } from "react";
import { Film, Anchor, CheckSquare, Users, Star, Shield, ChevronUp, ChevronDown, Clapperboard, Mic2 } from "lucide-react";

const BASE_NAV_ITEMS = [
  { label: "Flicks",      feature: "Flicks",      Icon: Film          },
  { label: "Hooks",       feature: "Hooks",       Icon: Anchor        },
  { label: "Task",        feature: "Task",        Icon: CheckSquare   },
  { label: "Circle",      feature: "Circle",      Icon: Users         },
  { label: "Antak",       feature: "Antakshari",  Icon: Mic2            },
  { label: "Fame",        feature: "QuotesMaker", Icon: Star          },
  { label: "Studio",      feature: "Studio",      Icon: Clapperboard  },
] as const;

const LIGHTNING_WORDS = [
  { word: "Flicks",     color: "#00e5ff", glow: "rgba(0,229,255,0.85)"  },
  { word: "Hooks",      color: "#ff2d78", glow: "rgba(255,45,120,0.85)" },
  { word: "Task",       color: "#ffd600", glow: "rgba(255,214,0,0.85)"  },
  { word: "Circle",     color: "#00ff88", glow: "rgba(0,255,136,0.85)"  },
  { word: "Antakshari", color: "#ff6b35", glow: "rgba(255,107,53,0.85)" },
  { word: "Fame",       color: "#bf5af2", glow: "rgba(191,90,242,0.85)" },
  { word: "Studio",     color: "#EF4444", glow: "rgba(239,68,68,0.85)"  },
];

interface GolSliderProps {
  onFeatureChange?: (feature: string) => void;
  activeFeature?: string;
  hidden?: boolean;
  isAdmin?: boolean;
}

const CYAN     = "#00e5ff";
const CYAN_DIM = "rgba(0,229,255,0.55)";
const BG_DARK  = "#0b0d12";
const BG_TRAY  = "rgba(11,13,18,0.96)";

const STYLE_ID = "gol-nav-styles";
function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes tab-underline-glow {
      0%   { box-shadow: 0 2px 8px rgba(0,229,255,0.55); }
      50%  { box-shadow: 0 2px 14px rgba(0,229,255,0.9); }
      100% { box-shadow: 0 2px 8px rgba(0,229,255,0.55); }
    }
    @keyframes gol-beam {
      0% { left: -90px; opacity: 0; }
      18% { opacity: .9; }
      82% { opacity: .9; }
      100% { left: calc(100% + 90px); opacity: 0; }
    }
    @keyframes gol-word-in {
      from { opacity: 0; transform: translateY(6px) scale(.88); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .gol-lightning-beam { animation: gol-beam 2.2s ease-in-out both; }
    .gol-lightning-word { animation: gol-word-in .5s ease-out both; }
    .gol-handle-glow { animation: gol-handle-glow 2.4s ease-in-out infinite; }
    .gol-chevron-pulse { animation: gol-chevron-pulse 2.4s ease-in-out infinite; }
    @keyframes gol-handle-glow {
      0%, 100% { box-shadow: 0 -3px 20px rgba(0,229,255,0.10), 0 0 0 rgba(0,229,255,0); }
      50% { box-shadow: 0 -3px 30px rgba(0,229,255,0.40), 0 0 14px rgba(0,229,255,0.18); }
    }
    @keyframes gol-chevron-pulse {
      0%, 100% { transform: scale(1); opacity: .6; }
      50% { transform: scale(1.25); opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

/* ── Lightning ticker — lives inside the handle bar, always visible ── */
function HandleLightning() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stop = () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      cycleTimerRef.current = null;
      fadeTimerRef.current = null;
    };
    const schedule = () => {
      stop();
      if (document.hidden) return;
      cycleTimerRef.current = setTimeout(() => {
        setVisible(false);
        fadeTimerRef.current = setTimeout(() => {
          setIndex((i) => (i + 1) % LIGHTNING_WORDS.length);
          setVisible(true);
          schedule();
        }, 500);
      }, 2800);
    };
    const onViz = () => {
      if (document.hidden) stop();
      else schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onViz);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onViz);
    };
  }, []);

  const { word, color, glow } = LIGHTNING_WORDS[index];

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Sweeping beam — slow left-to-right */}
      {visible && (
          <div
            className="gol-lightning-beam"
            style={{
              position: "absolute",
              top: 0,
              width: 90,
              height: "100%",
              background: `linear-gradient(90deg, transparent, ${color}35, ${color}80, ${color}35, transparent)`,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
      )}

      {/* Neon cursive word */}
      {visible && (
          <span
            key={word + index}
            className="gol-lightning-word"
            style={{
              color,
              textShadow: `0 0 6px ${glow}, 0 0 16px ${glow}, 0 0 32px ${glow}`,
              fontSize: 13,
              fontWeight: 700,
              fontStyle: "italic",
              fontFamily: "'Georgia', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
              letterSpacing: "0.12em",
              position: "relative",
              zIndex: 2,
              whiteSpace: "nowrap",
            }}
          >
            ⚡ {word} ⚡
          </span>
      )}
    </div>
  );
}

const GolSlider = ({ onFeatureChange, activeFeature, hidden, isAdmin }: GolSliderProps) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => { injectKeyframes(); }, []);

  const NAV_ITEMS = isAdmin
    ? [...BASE_NAV_ITEMS.slice(0, -2), { label: "Admin", feature: "Admin", Icon: Shield } as const, BASE_NAV_ITEMS[BASE_NAV_ITEMS.length - 1]]
    : BASE_NAV_ITEMS;

  if (hidden) return null;

  return (
    <div
      className="fixed bottom-0 left-0 w-full z-[200] flex flex-col"
      style={{ pointerEvents: "none" }}
    >
      {/* ── TRAY (slides up/down) ─────────────────────────────────────────────── */}
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
          className="flex items-stretch max-w-lg lg:max-w-none mx-auto w-full"
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
                    color: isActive ? CYAN : "rgba(255,255,255,0.65)",
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
                    color: isActive ? CYAN : "rgba(255,255,255,0.65)",
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

      {/* ── HANDLE BAR — always visible, contains lightning animation ─────────── */}
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="gol-handle-glow"
        style={{
          pointerEvents: "auto",
          background: BG_DARK,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          width: "100%",
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          cursor: "pointer",
          border: "none",
          borderTop: `1px solid ${CYAN_DIM}`,
          overflow: "hidden",
          position: "relative",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {/* Lightning word animation — takes all available width */}
        <HandleLightning />

        {/* Divider */}
        <span style={{ width: 1, height: 16, background: CYAN_DIM, flexShrink: 0 }} />

        {/* Pulsing chevron — right side */}
        <span
          className="gol-chevron-pulse"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: CYAN,
            width: 36,
            flexShrink: 0,
          }}
        >
          {isOpen
            ? <ChevronDown size={16} strokeWidth={3} />
            : <ChevronUp   size={16} strokeWidth={3} />
          }
        </span>
      </button>
    </div>
  );
};

export default GolSlider;
