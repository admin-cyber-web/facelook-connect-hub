import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { useProfileViewer } from "../context/ProfileViewerContext";
import HolographicStartMenu, {
  type HolographicStartMenuProps,
} from "./HolographicStartMenu";
import "./GolSlider.css";

type StartMenuDataProps = Pick<
  HolographicStartMenuProps,
  | "circles"
  | "pages"
  | "flicks"
  | "members"
  | "hotTag"
  | "onNavigateToCircles"
  | "onNavigateToPages"
  | "onNavigateToFlicks"
  | "onJoinCircle"
  | "onToggleHookPage"
  | "onOpenFlick"
>;

const AUTO_CLOSE_MS = 10_000;

interface GolSliderProps extends StartMenuDataProps {
  onFeatureChange?: (feature: string) => void;
  activeFeature?: string;
  isAdmin?: boolean;
}

const GolSlider = ({
  onFeatureChange,
  activeFeature,
  isAdmin = false,
  circles,
  pages,
  flicks,
  members,
  hotTag,
  onNavigateToCircles,
  onNavigateToPages,
  onNavigateToFlicks,
  onJoinCircle,
  onToggleHookPage,
  onOpenFlick,
}: GolSliderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"start" | "refresh">("start");
  const { openProfile } = useProfileViewer();
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

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
      const insideMenu =
        target instanceof Node &&
        document.getElementById("gol-start-menu")?.contains(target);
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
      if (
        document
          .getElementById("gol-start-menu")
          ?.contains(document.activeElement)
      ) {
        scheduleIdleClose();
      }
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
    setMode(nextMode);
    setIsOpen(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
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

  return (
    <div className="gol-start-dock">
      {mode === "start" && isOpen && (
        createPortal(
          <HolographicStartMenu
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            activeFeature={activeFeature}
            isAdmin={isAdmin}
            circles={circles}
            pages={pages}
            flicks={flicks}
            members={members}
            hotTag={hotTag}
            onFeatureChange={(feature) => {
              setIsOpen(false);
              onFeatureChange?.(feature);
            }}
            onNavigateToCircles={() => {
              setIsOpen(false);
              onNavigateToCircles();
            }}
            onNavigateToPages={() => {
              setIsOpen(false);
              onNavigateToPages();
            }}
            onNavigateToFlicks={() => {
              setIsOpen(false);
              onNavigateToFlicks();
            }}
            onOpenProfile={(id) => {
              setIsOpen(false);
              openProfile(String(id));
            }}
            onJoinCircle={(id) => {
              setIsOpen(false);
              onJoinCircle(id);
            }}
            onToggleHookPage={(id) => {
              setIsOpen(false);
              onToggleHookPage(id);
            }}
            onOpenFlick={(id) => {
              setIsOpen(false);
              onOpenFlick(id);
            }}
          />,
          document.body,
        )
      )}

      <button
        ref={startButtonRef}
        type="button"
        className={`gol-hybrid-button${mode === "refresh" ? " is-refresh" : ""}`}
        data-mode={mode}
        aria-label={
          mode === "refresh"
            ? "Refresh timeline. Swipe left or right to switch to Start."
            : isOpen
              ? "Close Start menu. Swipe left or right to switch to Refresh."
              : "Open Start menu. Swipe left or right to switch to Refresh."
        }
        aria-expanded={mode === "start" && isOpen}
        aria-controls={mode === "start" ? "gol-start-menu" : undefined}
        data-testid="button-start-refresh"
        title={mode === "refresh" ? "Swipe left or right to switch to Start" : "Swipe left or right to switch to Refresh"}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartRef.current = null;
        }}
        onKeyDown={handleButtonKeyDown}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            if (suppressClickTimerRef.current) {
              clearTimeout(suppressClickTimerRef.current);
            }
            suppressClickTimerRef.current = null;
            return;
          }

          if (mode === "refresh") {
            window.location.reload();
            return;
          }

          setIsOpen((open) => !open);
        }}
      >
        <span className="gol-hybrid-button__icon" aria-hidden="true">
          {mode === "refresh" ? (
            <RefreshCw
              size={20}
              strokeWidth={2.5}
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
          {mode === "start" ? "Start" : "Refresh"}
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
