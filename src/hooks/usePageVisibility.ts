import { useEffect, useState } from "react";

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