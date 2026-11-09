import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactEventHandler,
  type SyntheticEvent,
} from "react";
import { useProfileTimelineAudio } from "@/components/profile-navigation/ProfileTimelineAudio";
import { getVideoMimeType } from "@/lib/videoMimeType";
import { playVideoWithMutedFallback } from "@/lib/videoPlayback";
import { isHlsUrl, useHlsVideo } from "@/hooks/useHlsVideo";

interface Props {
  src: string;
  className?: string;
  poster?: string;
  objectFit?: CSSProperties["objectFit"];
  shimmer?: boolean;
  ariaLabel?: string;
  controls?: boolean;
  preload?: "none" | "metadata" | "auto";
  autoplayWithSound?: boolean;
  onError?: ReactEventHandler<HTMLVideoElement>;
  style?: CSSProperties;
  /** When true, parent's onClick still fires (default).  */
  passThroughClicks?: boolean;
  playbackEnabled?: boolean;
  visibilityThreshold?: number;
  onVisibilityChange?: (visible: boolean) => void;
  onPlaybackError?: (error: string | null) => void;
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
  objectFit = "cover",
  shimmer = true,
  ariaLabel,
  controls = false,
  preload = "metadata",
  autoplayWithSound = false,
  onError,
  style,
  passThroughClicks = true,
  playbackEnabled = true,
  visibilityThreshold = 0.7,
  onVisibilityChange,
  onPlaybackError,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const profileAudio = useProfileTimelineAudio();
  const profileAudioRef = useRef(profileAudio);
  profileAudioRef.current = profileAudio;
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmuteOverlay, setShowUnmuteOverlay] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const isHls = isHlsUrl(src);
  const hls = useHlsVideo(
    ref,
    src,
    isHls && isInViewport && playbackEnabled,
    undefined,
    isInViewport && playbackEnabled,
  );

  useEffect(() => {
    onPlaybackError?.(hls.error);
  }, [hls.error, onPlaybackError]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const audio = autoplayWithSound ? profileAudioRef.current : null;
    const unregister = audio?.registerVideo(el);
    if (!audio) {
      el.muted = true;
      setIsMuted(true);
    } else {
      el.muted = !audio.soundEnabled;
      setIsMuted(!audio.soundEnabled);
    }
    let isInViewport = false;
    const syncPlayback = () => {
      const video = ref.current;
      if (!video) return;
      const shouldPlay = isInViewport && playbackEnabled && !document.hidden;
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
      playVideoWithMutedFallback(video, () => {
        if (!isInViewport || !playbackEnabled || ref.current !== video) return false;
        setIsMuted(true);
        setShowUnmuteOverlay(true);
      });
    };
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const visible =
          entry.isIntersecting &&
          entry.intersectionRatio >= visibilityThreshold;
        isInViewport = visible;
        setIsInViewport(visible);
        onVisibilityChange?.(visible);
        syncPlayback();
      },
      { threshold: [0, visibilityThreshold] },
    );
    const preloadObserver = new IntersectionObserver(
      ([entry]) => setIsNearViewport(Boolean(entry?.isIntersecting)),
      { rootMargin: "75% 0px" },
    );
    const handleVisibilityChange = () => syncPlayback();
    io.observe(el);
    preloadObserver.observe(el);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      io.disconnect();
      preloadObserver.disconnect();
      onVisibilityChange?.(false);
      if (unregister) {
        unregister();
      } else {
        el.pause();
        el.muted = true;
      }
    };
  }, [
    src,
    autoplayWithSound,
    isMuted,
    playbackEnabled,
    visibilityThreshold,
    onVisibilityChange,
  ]);

  const handleError = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => {
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
        background: shimmer
          ? "linear-gradient(135deg, #1e1e2e 0%, #2d2d3a 50%, #1e1e2e 100%)"
          : "transparent",
        ...(shimmer ? { backgroundSize: "200% 200%", animation: "shimmer 3s ease-in-out infinite" } : {}),
      }}
    >
      {(showUnmuteOverlay || (autoplayWithSound && isInViewport && profileAudio?.needsGesture)) && (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-20 flex cursor-pointer items-center gap-2 rounded-full border border-white/25 bg-black/65 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-black/80"
          onClick={(event) => {
            event.stopPropagation();
            const video = ref.current;
            if (autoplayWithSound && profileAudio) {
              profileAudio.retryWithSound();
              setShowUnmuteOverlay(false);
              return;
            }
            if (video) {
              video.muted = false;
              setIsMuted(false);
              setShowUnmuteOverlay(false);
              playVideoWithMutedFallback(video, () => {
                if (ref.current !== video || !isInViewport) return false;
                setIsMuted(true);
                setShowUnmuteOverlay(true);
              });
            }
          }}
          aria-label="Tap to enable video sound"
        >
          <span aria-hidden="true">🔊</span>
          Tap to unmute
        </button>
      )}
      <video
        ref={ref}
        poster={poster}
        aria-label={ariaLabel}
        controls={controls}
        muted={
          hasError ||
          !autoplayWithSound ||
          !profileAudio ||
          profileAudio.needsGesture ||
          isMuted
        }
        loop
        playsInline
        webkitPlaysInline
        crossOrigin="anonymous"
        preload={preload === "none" ? "none" : isNearViewport ? "auto" : preload}
        autoPlay={isInViewport && playbackEnabled}
        {...{
          "webkit-playsinline": "true",
          "x5-playsinline": "true",
        }}
        onError={handleError}
        onLoadedData={handleLoadedData}
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          display: hasError ? "none" : "block",
        }}
      >
        {!isHls && src && <source src={src} type={getVideoMimeType(src)} />}
      </video>
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 bg-black/20">
          <span className="text-2xl">📼</span>
          <span className="text-xs font-medium mt-1">Video unavailable</span>
        </div>
      )}
      {shimmer && !poster && !hasError && !src.startsWith("blob:") && (
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
