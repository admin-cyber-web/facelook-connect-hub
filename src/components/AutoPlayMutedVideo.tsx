import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactEventHandler,
} from "react";
import { useProfileTimelineAudio } from "@/components/profile-navigation/ProfileTimelineAudio";

interface Props {
  src: string;
  className?: string;
  poster?: string;
  ariaLabel?: string;
  controls?: boolean;
  preload?: "none" | "metadata" | "auto";
  autoplayWithSound?: boolean;
  onError?: ReactEventHandler<HTMLVideoElement>;
  style?: CSSProperties;
  /** When true, parent's onClick still fires (default).  */
  passThroughClicks?: boolean;
}

/**
 * Auto-play video tile:
 *   • profile videos attempt audible playback while in viewport
 *   • other feed tiles remain muted
 *   • pauses when scrolled away
 *   • pointer-events: none so the parent card's onClick (which opens the
 *     full Flicks player WITH sound) always wins
 *   • shows blur backdrop / poster until video loads
 *   • shows "Tap to Unmute" overlay when audio is blocked
 */
export default function AutoPlayMutedVideo({
  src,
  className,
  poster,
  ariaLabel,
  controls = false,
  preload = "auto",
  autoplayWithSound = false,
  onError,
  style,
  passThroughClicks = true,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const profileAudio = useProfileTimelineAudio();
  const profileAudioRef = useRef(profileAudio);
  profileAudioRef.current = profileAudio;
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmuteOverlay, setShowUnmuteOverlay] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const audio = autoplayWithSound ? profileAudioRef.current : null;
    const unregister = audio?.registerVideo(el);
    if (!audio) {
      el.muted = true;
      setIsMuted(true);
    } else {
      // Attempt audible playback; if blocked, fall back to muted
      el.muted = false;
      setIsMuted(false);
      el.play().catch(() => {
        el.muted = true;
        setIsMuted(true);
        setShowUnmuteOverlay(true);
      });
    }
    let isInViewport = false;
    const syncPlayback = () => {
      const video = ref.current;
      if (!video) return;
      const shouldPlay = isInViewport && !document.hidden;
      const activeAudio = autoplayWithSound ? profileAudioRef.current : null;
      if (activeAudio) {
        activeAudio.setVideoVisible(video, shouldPlay);
        return;
      }
      if (!shouldPlay) {
        video.pause();
        video.muted = true;
        return;
      }
      video.muted = isMuted;
      void video.play().catch(() => {
        if (!video.isConnected || ref.current !== video) return;
        video.muted = true;
        setIsMuted(true);
        void video.play().catch(() => {});
      });
    };
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        isInViewport =
          entry.isIntersecting && entry.intersectionRatio >= 0.6;
        syncPlayback();
      },
      { threshold: [0, 0.6] },
    );
    const handleVisibilityChange = () => syncPlayback();
    io.observe(el);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      io.disconnect();
      if (unregister) {
        unregister();
      } else {
        el.pause();
        el.muted = true;
      }
    };
  }, [src, autoplayWithSound, isMuted]);

  const handleError = useCallback(
    (e: ReactEventHandler<HTMLVideoElement>) => {
      setHasError(true);
      onError?.(e);
    },
    [onError],
  );

  const handleLoadedData = useCallback(() => {
    setHasError(false);
  }, []);

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{
        ...style,
        ...(passThroughClicks ? { pointerEvents: "none" } : {}),
        background:
          "linear-gradient(135deg, #1e1e2e 0%, #2d2d3a 50%, #1e1e2e 100%)",
        backgroundSize: "200% 200%",
        animation: "shimmer 3s ease-in-out infinite",
      }}
    >
      {showUnmuteOverlay && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 z-10"
          role="button"
          tabIndex={0}
          onClick={() => {
            const video = ref.current;
            if (video) {
              video.muted = false;
              setIsMuted(false);
              setShowUnmuteOverlay(false);
              void video.play().catch(() => {});
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              const video = ref.current;
              if (video) {
                video.muted = false;
                setIsMuted(false);
                setShowUnmuteOverlay(false);
                void video.play().catch(() => {});
              }
            }
          }}
          aria-label="Tap to unmute"
        >
          <div className="flex flex-col items-center gap-2 text-white">
            <span className="text-4xl">🔇</span>
            <span className="text-sm font-medium text-white/90">Tap to Unmute</span>
          </div>
        </div>
      )}
      <video
        ref={ref}
        poster={poster}
        aria-label={ariaLabel}
        controls={controls}
        muted={hasError ? true : !autoplayWithSound || !profileAudio || isMuted}
        loop
        playsInline
        webkitPlaysInline
        crossOrigin="anonymous"
        preload={preload}
        onError={handleError}
        onLoadedData={handleLoadedData}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: hasError || showUnmuteOverlay ? "none" : "block",
        }}
      >
        {src && (
          <source src={src} type="video/mp4" />
        )}
      </video>
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 bg-black/20">
          <span className="text-2xl">📼</span>
          <span className="text-xs font-medium mt-1">Video unavailable</span>
        </div>
      )}
      {!poster && !hasError && !src.startsWith("blob:") && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-gray-900/50 via-gray-800/30 to-gray-900/50 z-0"
        />
      )}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0%; }
          100% { background-position: -200% 0%; }
        }
      `}</style>
    </div>
  );
}
