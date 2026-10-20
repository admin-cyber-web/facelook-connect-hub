import {
  useEffect,
  useRef,
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
 */
export default function AutoPlayMutedVideo({
  src,
  className,
  poster,
  ariaLabel,
  controls = false,
  preload = "metadata",
  autoplayWithSound = false,
  onError,
  style,
  passThroughClicks = true,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const profileAudio = useProfileTimelineAudio();
  const profileAudioRef = useRef(profileAudio);
  profileAudioRef.current = profileAudio;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const audio = autoplayWithSound ? profileAudioRef.current : null;
    const unregister = audio?.registerVideo(el);
    if (!audio) el.muted = true;
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
      video.muted = true;
      void video.play().catch(() => {
        if (!video.isConnected || ref.current !== video) return;
        video.muted = true;
        void video.play().catch(() => {});
      });
    };
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        isInViewport =
          entry.isIntersecting && entry.intersectionRatio >= 0.4;
        syncPlayback();
      },
      { threshold: [0, 0.4] },
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
  }, [src, autoplayWithSound]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className={className}
      aria-label={ariaLabel}
      controls={controls}
      onError={onError}
      muted={!autoplayWithSound || !profileAudio}
      loop
      playsInline
      preload={preload}
      style={{
        ...style,
        ...(passThroughClicks ? { pointerEvents: "none" } : {}),
      }}
    />
  );
}
