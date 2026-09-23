import { useEffect, useRef, useState, ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  disabled?: boolean;
  threshold?: number;
}

export default function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  threshold = 70,
}: Props) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const gestureState = useRef<"undecided" | "pulling" | "blocked">("blocked");
  const pullDistanceRef = useRef(0);
  const pullYRef = useRef(0);
  const pullRafRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const touchTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    pullYRef.current = pullY;
  }, [pullY]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (disabled) return;
    const el = wrapperRef.current;
    if (!el) return;

    /**
     * WebView scroll position is not always represented by window.scrollY.
     * Depending on the wrapper and document mode, the active value can live
     * on document.scrollingElement, documentElement, or body. Check all of
     * them instead of choosing one at mount time.
     */
    const getDocumentScrollTop = (): number => {
      const scrollingElement = document.scrollingElement;
      return Math.max(
        window.scrollY,
        window.pageYOffset,
        scrollingElement?.scrollTop ?? 0,
        document.documentElement.scrollTop,
        document.body.scrollTop,
        0,
      );
    };

    /**
     * Return every scrollable ancestor between the touch target and this
     * wrapper. An inner list at scrollTop 0 is still not pull-to-refresh
     * eligible if the document itself is already scrolled.
     */
    const getScrollableAncestors = (target: EventTarget | null): HTMLElement[] => {
      const ancestors: HTMLElement[] = [];
      let node: HTMLElement | null =
        target instanceof HTMLElement
          ? target
          : target instanceof Element
            ? target.parentElement
            : el;

      while (node) {
        if (node !== document.body && node !== document.documentElement) {
          const { overflowY } = window.getComputedStyle(node);
          const canScrollY = /(auto|scroll|overlay)/.test(overflowY);
          if (canScrollY && node.scrollHeight > node.clientHeight) {
            ancestors.push(node);
          }
        }
        if (node === el) break;
        node = node.parentElement;
      }
      return ancestors;
    };

    // WebView can report a fractional sub-pixel value at the boundary. Treat
    // that as the top while never allowing a real offset to start a refresh.
    const isAtTop = (target: EventTarget | null = touchTargetRef.current): boolean =>
      getDocumentScrollTop() <= 1 &&
      getScrollableAncestors(target).every((node) => node.scrollTop <= 1);

    const paintPull = (value: number) => {
      pullYRef.current = value;
      if (pullRafRef.current !== null) {
        cancelAnimationFrame(pullRafRef.current);
      }
      pullRafRef.current = requestAnimationFrame(() => {
        pullRafRef.current = null;
        setPullY(pullYRef.current);
      });
    };

    const resetPull = () => {
      pullDistanceRef.current = 0;
      startPoint.current = null;
      touchTargetRef.current = null;
      gestureState.current = "blocked";
      paintPull(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchTargetRef.current = e.target;
      if (e.touches.length !== 1 || refreshingRef.current || !isAtTop(e.target)) {
        resetPull();
        return;
      }

      startPoint.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      gestureState.current = "undecided";
      pullDistanceRef.current = 0;
      pullYRef.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (
        startPoint.current == null ||
        refreshingRef.current ||
        e.touches.length !== 1 ||
        gestureState.current === "blocked"
      ) {
        return;
      }

      const dx = e.touches[0].clientX - startPoint.current.x;
      const dy = e.touches[0].clientY - startPoint.current.y;

      // Let the browser own taps, horizontal gestures, and upward scrolling.
      // Once one of these directions wins, this touch cannot become a pull.
      const directionLock = 8;
      if (Math.abs(dx) > Math.abs(dy) || dy <= 0) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= directionLock) {
          gestureState.current = "blocked";
          pullDistanceRef.current = 0;
          paintPull(0);
        }
        return;
      }

      // Avoid taking over if native scrolling has already moved the document
      // or any nested scroll surface away from its absolute top.
      if (!isAtTop(touchTargetRef.current || e.target)) {
        gestureState.current = "blocked";
        pullDistanceRef.current = 0;
        paintPull(0);
        return;
      }

      if (dy < directionLock) return;

      gestureState.current = "pulling";
      pullDistanceRef.current = dy;

      // Only claim the gesture after it is unambiguously a downward pull at
      // scrollTop === 0. This prevents WebView overscroll without affecting
      // normal page scrolling, taps, or horizontal gestures.
      if (e.cancelable) {
        e.preventDefault();
      }

      // Resistance keeps the content movement subtle while retaining a
      // responsive progress indicator. The raw distance controls the trigger.
      const damped = Math.min(dy * 0.7, threshold * 1.35);
      paintPull(damped);
    };

    const onTouchEnd = async () => {
      if (startPoint.current == null) return;
      const pullDistance = pullDistanceRef.current;
      const shouldRefresh =
        gestureState.current === "pulling" &&
        pullDistance >= threshold &&
        isAtTop(touchTargetRef.current) &&
        !refreshingRef.current;
      startPoint.current = null;
      gestureState.current = "blocked";

      if (shouldRefresh) {
        setRefreshing(true);
        refreshingRef.current = true;
        paintPull(threshold);
        try {
          await onRefreshRef.current();
        } catch (err) {
          console.warn("[PullToRefresh] onRefresh error:", err);
        } finally {
          setRefreshing(false);
          refreshingRef.current = false;
          resetPull();
        }
      } else {
        resetPull();
      }
    };

    const onTouchCancel = () => {
      if (startPoint.current !== null || pullYRef.current > 0) {
        resetPull();
      }
    };

    // Capture ensures child components cannot accidentally swallow the
    // gesture, while the move listener remains passive until it is actually
    // eligible to prevent WebView overscroll.
    el.addEventListener("touchstart", onTouchStart, {
      passive: true,
      capture: true,
    });
    el.addEventListener("touchmove", onTouchMove, {
      passive: false,
      capture: true,
    });
    el.addEventListener("touchend", onTouchEnd, {
      passive: true,
      capture: true,
    });
    el.addEventListener("touchcancel", onTouchCancel, {
      passive: true,
      capture: true,
    });

    return () => {
      if (pullRafRef.current !== null) {
        cancelAnimationFrame(pullRafRef.current);
        pullRafRef.current = null;
      }
      el.removeEventListener("touchstart", onTouchStart, true);
      el.removeEventListener("touchmove", onTouchMove, true);
      el.removeEventListener("touchend", onTouchEnd, true);
      el.removeEventListener("touchcancel", onTouchCancel, true);
    };
  }, [threshold, disabled]);

  const progress = Math.min(pullY / threshold, 1);
  const readyToRefresh = pullY >= threshold * 0.7;

  return (
    <div
      ref={wrapperRef}
      className="relative touch-scroll-y"
      style={{
        touchAction: "pan-y",
        overscrollBehaviorY: "contain",
      }}
    >
      {/* Indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
        style={{
          top: 8,
          pointerEvents: "none",
          transform: `translate(-50%, ${pullY - 40}px)`,
          opacity: progress,
          willChange: "transform, opacity",
          transition:
            refreshing || pullY === 0
              ? "transform 200ms ease, opacity 200ms ease"
              : "none",
        }}
      >
        <div
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-gray-100 bg-white px-2.5 shadow-lg"
          role={refreshing ? "status" : undefined}
          aria-label={refreshing ? "Refreshing feed" : undefined}
          aria-live={refreshing ? "polite" : undefined}
        >
          <RefreshCw
            size={15}
            className={readyToRefresh || refreshing ? "text-blue-600" : "text-slate-400"}
            style={{
              transform: `rotate(${progress * 360}deg)`,
              animation: refreshing ? "spin 0.8s linear infinite" : undefined,
            }}
          />
          <span className="whitespace-nowrap text-[10px] font-bold text-slate-600">
            {refreshing
              ? "Refreshing…"
              : readyToRefresh
                ? "Release to refresh"
                : "Pull to refresh"}
          </span>
        </div>
      </div>

      {/* Content shifts down while pulling, snaps back on release */}
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition:
            refreshing || pullY === 0 ? "transform 200ms ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
