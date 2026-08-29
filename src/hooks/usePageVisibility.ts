import { useEffect, useState } from "react";

/**
 * Tracks whether the browser page is visible.
 *
 * Components that own realtime channels or background refreshes should use this
 * to stop network activity while the tab is hidden. The initial value is
 * visible so SSR and the first client render remain safe.
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  return isVisible;
}