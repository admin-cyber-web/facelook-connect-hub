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
  const menuRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (hidden) setIsOpen(false);
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
      <div className="gol-start-dock__background" aria-hidden="true" />

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
        className="gol-start-button"
        aria-label={isOpen ? "Close Start menu" : "Open Start menu"}
        aria-expanded={isOpen}
        aria-controls="gol-start-menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="gol-start-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="gol-start-button__label">Start</span>
      </button>

      {/* Keep the refresh marble independent and centered in its own portal. */}
      <AquariumRefreshButton onRefresh={onRefresh} />
    </div>
  );
};

export default GolSlider;
