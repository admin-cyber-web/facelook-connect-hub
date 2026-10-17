import { useCallback, useEffect, useRef, useState } from "react";
import AquariumRefreshButton from "@/components/AquariumRefreshButton";
import "./GolSlider.css";

const START_MENU_ITEMS = [
  { label: "Fame Feed", emoji: "🏠", feature: "Fame" },
  { label: "Circles", emoji: "🔵", feature: "Circle" },
  { label: "Hook Pages", emoji: "⚡", feature: "Hooks" },
  { label: "Flicks", emoji: "🎬", feature: "Flicks" },
  { label: "Surveys", emoji: "📊", feature: "Task" },
  { label: "Quotes Maker", emoji: "💬", feature: "QuotesMaker" },
] as const;

const AUTO_CLOSE_MS = 10_000;
const HOLD_TO_SHOW_MS = 800;
const START_AUTO_HIDE_MS = 2_500;

interface GolSliderProps {
  onFeatureChange?: (feature: string) => void;
  activeFeature?: string;
  hidden?: boolean;
  onRefresh: () => Promise<void> | void;
}

const GolSlider = ({
  onFeatureChange,
  activeFeature,
  hidden,
  onRefresh,
}: GolSliderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isStartVisible, setIsStartVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hidden) return;

    const clearHoldTimer = () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    };

    const scheduleReveal = () => {
      clearHoldTimer();
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        setIsStartVisible(true);
      }, HOLD_TO_SHOW_MS);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        clearHoldTimer();
        return;
      }
      scheduleReveal();
    };
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) scheduleReveal();
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", clearHoldTimer);
    document.addEventListener("touchcancel", clearHoldTimer);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", clearHoldTimer);
    document.addEventListener("scroll", clearHoldTimer, {
      capture: true,
      passive: true,
    });
    window.addEventListener("scroll", clearHoldTimer, { passive: true });

    return () => {
      clearHoldTimer();
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", clearHoldTimer);
      document.removeEventListener("touchcancel", clearHoldTimer);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", clearHoldTimer);
      document.removeEventListener("scroll", clearHoldTimer, true);
      window.removeEventListener("scroll", clearHoldTimer);
    };
  }, [hidden]);

  useEffect(() => {
    if (!isStartVisible) return;

    const timer = setTimeout(() => {
      setIsStartVisible(false);
      setIsOpen(false);
    }, START_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [isStartVisible]);

  const scheduleIdleClose = useCallback(() => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    autoCloseTimerRef.current = setTimeout(() => {
      autoCloseTimerRef.current = null;
      setIsOpen(false);
    }, AUTO_CLOSE_MS);
  }, []);

  useEffect(() => {
    if (hidden || !isOpen) {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
      if (hidden) {
        setIsOpen(false);
        setIsStartVisible(false);
      }
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
  }, [hidden, isOpen, scheduleIdleClose]);

  if (hidden) return null;

  return (
    <div className="gol-start-dock">
      {isOpen && (
        <div
          id="gol-start-menu"
          ref={menuRef}
          className="gol-start-menu"
          role="menu"
          aria-label="Start menu"
        >
          {START_MENU_ITEMS.map(({ label, emoji, feature }) => {
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
                  {emoji}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        ref={startButtonRef}
        type="button"
        className={`gol-start-button aquarium-refresh-marble${isStartVisible ? " is-visible" : ""}`}
        aria-label={isOpen ? "Close Start menu" : "Open Start menu"}
        aria-expanded={isOpen}
        aria-controls="gol-start-menu"
        aria-hidden={!isStartVisible}
        data-testid="button-open-start-menu"
        tabIndex={isStartVisible ? 0 : -1}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="aquarium-marble-water" aria-hidden="true" />
        <span className="aquarium-marble-bubble aquarium-marble-bubble--one" aria-hidden="true" />
        <span className="aquarium-marble-bubble aquarium-marble-bubble--two" aria-hidden="true" />
        <span className="aquarium-marble-bubble aquarium-marble-bubble--three" aria-hidden="true" />
        <svg
          className="aquarium-marble-fish"
          viewBox="0 0 28 18"
          aria-hidden="true"
        >
          <path d="M6 9c3.3-4.7 10.6-5.2 15.1 0-4.5 5.2-11.8 4.7-15.1 0Z" fill="#ffbd5b" />
          <path d="M6.5 9 1.5 5.4v7.2L6.5 9Z" fill="#ff7185" />
          <path d="m12 5.1 2-2.6 2.4 3" fill="none" stroke="#fff0b2" strokeWidth="1.3" strokeLinecap="round" />
          <path d="m12 12.9 2 2.4 2.4-2.8" fill="none" stroke="#fff0b2" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="17.5" cy="7.5" r="0.8" fill="#173047" />
          <circle cx="17.7" cy="7.3" r="0.25" fill="#fff" />
        </svg>
        <span className="aquarium-marble-label" aria-hidden="true">
          Start
        </span>
      </button>

      {/* Keep the refresh marble independent and centered in its own portal. */}
      <AquariumRefreshButton onRefresh={onRefresh} />
    </div>
  );
};

export default GolSlider;
