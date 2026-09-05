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
  const startY = useRef<number | null>(null);
  const pullYRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

    // Walk up the DOM to find the nearest scrolled ancestor.
    // FameFeed lives inside a custom scrollable div (not window), so
    // window.scrollY is always 0 — we must check the actual scroll container.
    const getScrollTop = (): number => {
      let node: HTMLElement | null = el;
      while (node) {
        if (node.scrollTop > 4) return node.scrollTop;
        node = node.parentElement;
      }
      return window.scrollY;
    };

    const onTouchStart = (e: TouchEvent) => {
      // Only arm the puller when the feed is truly at the top.
      if (getScrollTop() > 4) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null || refreshingRef.current) return;
      // If the user scrolled down since touchstart, disarm immediately.
      if (getScrollTop() > 4) { startY.current = null; setPullY(0); return; }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { setPullY(0); return; }
      // Resistance curve: feels rubbery, capped at 1.6× threshold.
      const damped = Math.min(dy * 0.45, threshold * 1.6);
      setPullY(damped);
    };

    const onTouchEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pullYRef.current >= threshold && !refreshingRef.current) {
        setRefreshing(true);
        refreshingRef.current = true;
        setPullY(threshold);
        try { await onRefreshRef.current(); } finally {
          setRefreshing(false);
          refreshingRef.current = false;
          pullYRef.current = 0;
          setPullY(0);
        }
      } else {
        setPullY(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: true });
    el.addEventListener("touchend",   onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, [threshold, disabled]);

  const progress = Math.min(pullY / threshold, 1);

  return (
    <div ref={wrapperRef} className="relative">
      {/* Indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
        style={{
          top: 8,
          transform: `translate(-50%, ${pullY - 40}px)`,
          opacity: progress,
          transition: refreshing || pullY === 0 ? "transform 200ms ease, opacity 200ms ease" : "none",
        }}
      >
        <div className="w-9 h-9 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center">
          <RefreshCw
            size={16}
            className="text-blue-600"
            style={{
              transform: `rotate(${progress * 360}deg)`,
              animation: refreshing ? "spin 0.8s linear infinite" : undefined,
            }}
          />
        </div>
      </div>

      {/* Content shifts down while pulling, snaps back on release */}
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: refreshing || pullY === 0 ? "transform 200ms ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
