import { useEffect, useRef, useState } from "react";

/**
 * True only while this document is visible to the user.
 *
 * Realtime channels and refresh work should use this as a lifecycle boundary:
 * a hidden tab cannot benefit from live UI updates, but it can still consume
 * Supabase bandwidth and keep the mobile radio/CPU awake.
 */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}

export interface VisibleIntervalOptions {
  /** Run once when the interval is first enabled. */
  runOnMount?: boolean;
  /** Run once immediately after returning from a hidden state. */
  runOnResume?: boolean;
  /** Restart the interval when a caller's logical timer target changes. */
  resetKey?: unknown;
}

/**
 * Runs an interval only while the document is visible, with deterministic
 * cleanup and optional immediate refresh on mount/resume.
 */
export function useVisibleInterval(
  callback: () => void,
  delay: number,
  enabled = true,
  options: VisibleIntervalOptions = {},
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const {
    runOnMount = false,
    runOnResume = false,
    resetKey,
  } = options;

  useEffect(() => {
    if (!enabled || delay <= 0) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };
    const start = (resuming: boolean) => {
      if (intervalId !== null || document.hidden) return;
      if (resuming ? runOnResume : runOnMount) callbackRef.current();
      intervalId = window.setInterval(() => {
        if (document.hidden) {
          stop();
          return;
        }
        callbackRef.current();
      }, delay);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) stop();
      else start(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    start(false);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stop();
    };
  }, [delay, enabled, resetKey, runOnMount, runOnResume]);
}