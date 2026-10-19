import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { RefreshCw, TrendingUp, type LucideIcon } from "lucide-react";
import "./GolSlider.css";

type StartMenuItem = {
  label: string;
  feature: string;
  emoji?: string;
  icon?: LucideIcon;
};

const START_MENU_ITEMS = [
  { label: "Fame Feed", emoji: "🏠", feature: "Fame" },
  { label: "Circles", emoji: "🔵", feature: "Circle" },
  { label: "Hook Pages", emoji: "⚡", feature: "Hooks" },
  { label: "Flicks", emoji: "🎬", feature: "Flicks" },
  { label: "Surveys", emoji: "📊", feature: "Task" },
  { label: "Quotes Maker", emoji: "💬", feature: "QuotesMaker" },
  { label: "Studio", icon: TrendingUp, feature: "Studio" },
] satisfies StartMenuItem[];

const AUTO_CLOSE_MS = 10_000;

interface GolSliderProps {
  onFeatureChange?: (feature: string) => void;
  activeFeature?: string;
  onRefresh: () => Promise<void> | void;
}

const GolSlider = ({
  onFeatureChange,
  activeFeature,
  onRefresh,
}: GolSliderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"start" | "refresh">("start");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  const scheduleIdleClose = useCallback(() => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    autoCloseTimerRef.current = setTimeout(() => {
      autoCloseTimerRef.current = null;
      setIsOpen(false);
    }, AUTO_CLOSE_MS);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
      return;
    }

    scheduleIdleClose();

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      const insideMenu = target instanceof Node && menuRef.current?.contains(target);
      const insideStartButton =
        target instanceof Node && startButtonRef.current?.contains(target);

      if (!insideMenu && !insideStartButton) {
        setIsOpen(false);
        return;
      }
      if (insideMenu) scheduleIdleClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        startButtonRef.current?.focus();
        return;
      }
      if (menuRef.current?.contains(document.activeElement)) scheduleIdleClose();
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    };
  }, [isOpen, scheduleIdleClose]);

  useEffect(
    () => () => {
      if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
    },
    [],
  );

  const switchMode = (nextMode: "start" | "refresh") => {
    if (isRefreshing) return;
    setMode(nextMode);
    setIsOpen(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isRefreshing) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) <= 20 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    event.preventDefault();
    event.stopPropagation();
    switchMode(mode === "start" ? "refresh" : "start");
    suppressClickRef.current = true;
    if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 350);
  };

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      switchMode(event.key === "ArrowLeft" ? "refresh" : "start");
    }
  };

  const handleButtonClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
      return;
    }

    if (mode === "start") {
      setIsOpen((open) => !open);
      return;
    }
    if (refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setIsOpen(false);
    setIsRefreshing(true);
    void Promise.resolve()
      .then(onRefresh)
      .catch((error) => {
        console.error("[GolSlider] Refresh failed:", error);
        window.location.reload();
      })
      .finally(() => {
        refreshInFlightRef.current = false;
        setIsRefreshing(false);
      });
  };

  return (
    <div className="gol-start-dock">
      {mode === "start" && isOpen && (
        <div
          id="gol-start-menu"
          ref={menuRef}
          className="gol-start-menu"
          role="menu"
          aria-label="Start menu"
        >
          {START_MENU_ITEMS.map(({ label, emoji, icon: Icon, feature }) => {
            const isActive = activeFeature === feature;
            return (
              <button
                key={feature}
                type="button"
                role="menuitem"
                aria-current={isActive ? "page" : undefined}
                className={`gol-start-menu__item${isActive ? " is-active" : ""}`}
                onClick={() => {
                  onFeatureChange?.(feature);
                  setIsOpen(false);
                }}
              >
                <span className="gol-start-menu__emoji" aria-hidden="true">
                  {Icon ? <Icon size={16} strokeWidth={2.5} /> : emoji}
                </span>
                <span className="gol-start-menu__label">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        ref={startButtonRef}
        type="button"
        className={`gol-hybrid-button${mode === "refresh" ? " is-refresh" : ""}`}
        data-mode={mode}
        aria-label={
          mode === "refresh"
            ? isRefreshing
              ? "Refreshing timeline"
              : "Refresh timeline. Swipe left or right to switch to Start."
            : isOpen
              ? "Close Start menu. Swipe left or right to switch to Refresh."
              : "Open Start menu. Swipe left or right to switch to Refresh."
        }
        aria-expanded={mode === "start" && isOpen}
        aria-controls={mode === "start" ? "gol-start-menu" : undefined}
        aria-busy={isRefreshing}
        data-testid="button-start-refresh"
        title={mode === "refresh" ? "Swipe left or right to switch to Start" : "Swipe left or right to switch to Refresh"}
        disabled={isRefreshing}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartRef.current = null;
        }}
        onKeyDown={handleButtonKeyDown}
        onClick={handleButtonClick}
      >
        <span className="gol-hybrid-button__icon" aria-hidden="true">
          {mode === "refresh" ? (
            <RefreshCw
              size={20}
              strokeWidth={2.5}
              className={isRefreshing ? "gol-hybrid-button__refresh-icon is-spinning" : ""}
            />
          ) : (
            <svg viewBox="0 0 36 36" className="gol-hybrid-button__tiranga-mark">
              <path d="M3 24c5-4 9 4 14 0s9-4 16 0" fill="none" stroke="#ff9933" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M3 28c5-4 9 4 14 0s9-4 16 0" fill="none" stroke="#f8fbff" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M3 32c5-4 9 4 14 0s9-4 16 0" fill="none" stroke="#19b66a" strokeWidth="2.2" strokeLinecap="round" />
              <path d="m7 8 5-3 4 4-5 4Z" fill="#ff9933" />
              <path d="m19 8 5-3 4 4-5 4Z" fill="#f8fbff" />
              <path d="m13 15 5-3 4 4-5 4Z" fill="#4facfe" />
              <path d="m25 15 5-3 4 4-5 4Z" fill="#19b66a" />
            </svg>
          )}
        </span>
        <span className="gol-hybrid-button__label">
          {isRefreshing ? "Refreshing…" : mode === "start" ? "Start" : "Refresh"}
        </span>
        <span className="gol-hybrid-button__switch" aria-hidden="true">
          <span className={mode === "start" ? "is-active" : ""} />
          <span className={mode === "refresh" ? "is-active" : ""} />
        </span>
      </button>
    </div>
  );
};

export default GolSlider;
