import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./AquariumRefreshButton.css";

export const AQUARIUM_REFRESH_WIPE_MS = 960;

interface AquariumRefreshButtonProps {
  onRefresh: () => Promise<void> | void;
}

export default function AquariumRefreshButton({
  onRefresh,
}: AquariumRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const refreshInFlightRef = useRef(false);
  const wipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (wipeTimerRef.current) clearTimeout(wipeTimerRef.current);
    },
    [],
  );

  const handleRefresh = () => {
    if (refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setIsRefreshing(true);
    setIsWiping(true);
    wipeTimerRef.current = setTimeout(() => {
      wipeTimerRef.current = null;
      setIsWiping(false);
    }, AQUARIUM_REFRESH_WIPE_MS);

    void Promise.resolve()
      .then(onRefresh)
      .catch((error) => {
        console.error("[AquariumRefresh] Refresh failed:", error);
        window.location.reload();
      })
      .finally(() => {
        refreshInFlightRef.current = false;
        setIsRefreshing(false);
      });
  };

  return (
    <>
      <button
        type="button"
        className="aquarium-refresh-marble"
        onClick={handleRefresh}
        disabled={isRefreshing}
        aria-label={isRefreshing ? "Refreshing feed" : "Refresh feed"}
        aria-busy={isRefreshing}
        title="Refresh"
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
        <span className="aquarium-marble-label">Refresh</span>
      </button>
      {isWiping && (
        createPortal(
          <div className="gol-board-duster-wipe" aria-hidden="true" />,
          document.body,
        )
      )}
    </>
  );
}
