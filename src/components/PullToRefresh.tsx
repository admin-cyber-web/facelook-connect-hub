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

    // Resolve the actual scroll surface once. FameFeed usually uses the
    // document, but this also supports feature pages inside a scrollable pane.
    // Do not infer "top" with a tolerance: pull-to-refresh is only allowed at
    // the exact top position.
    const findScrollContainer = (): HTMLElement | null => {
      let node = el.parentElement;
      while (node) {
        const isDocumentRoot =
          node === document.body || node === document.documentElement;
        const { overflowY } = window.getComputedStyle(node);
        const canScrollY = /(auto|scroll|overlay)/.test(overflowY);
        if (
          !isDocumentRoot &&
          canScrollY &&
          node.scrollHeight > node.clientHeight
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const scrollContainer = findScrollContainer();
    const getScrollTop = (): number =>
      scrollContainer ? scrollContainer.scrollTop : window.scrollY;
    const isAtExactTop = (): boolean => getScrollTop() === 0;
    const resetPull = () => {
      pullYRef.current = 0;
      setPullY(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || refreshingRef.current || !isAtExactTop()) {
        startY.current = null;
        resetPull();
        return;
      }
      startY.current = e.touches[0].clientY;
      pullYRef.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (
        startY.current == null ||
        refreshingRef.current ||
        e.touches.length !== 1
      ) {
        return;
      }
      // An upward/normal scroll moves the surface away from the exact top.
      // Disarm immediately so this gesture can only scroll the content.
      if (!isAtExactTop()) {
        startY.current = null;
        resetPull();
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        resetPull();
        return;
      }
      // Resistance curve: feels rubbery, capped at 1.6× threshold.
      const damped = Math.min(dy * 0.45, threshold * 1.6);
      pullYRef.current = damped;
      setPullY(damped);
    };

    const onTouchEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      const pullDistance = pullYRef.current;
      if (
        pullDistance >= threshold &&
        !refreshingRef.current &&
        isAtExactTop()
      ) {
        setRefreshing(true);
        refreshingRef.current = true;
        setPullY(threshold);
        try { await onRefreshRef.current(); } finally {
          setRefreshing(false);
          refreshingRef.current = false;
          resetPull();
        }
      } else {
        resetPull();
      }
    };

    const onTouchCancel = () => {
      startY.current = null;
      resetPull();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: true });
    el.addEventListener("touchend",   onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [threshold, disabled]);

  const progress = Math.min(pullY / threshold, 1);

  return (
    <div
      ref={wrapperRef}
      className="relative touch-scroll-y"
      style={{ touchAction: "pan-y" }}
    >
      {/* Indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
        style={{
          top: 8,
          pointerEvents: "none",
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
