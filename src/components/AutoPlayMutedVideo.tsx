import { useEffect, useRef } from "react";
import { useProfileTimelineAudio } from "@/components/profile-navigation/ProfileTimelineAudio";

interface Props {
  src: string;
  className?: string;
  poster?: string;
  ariaLabel?: string;
  controls?: boolean;
  preload?: "none" | "metadata" | "auto";
  autoplayWithSound?: boolean;
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
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const video = ref.current;
        if (!entry || !video) return;
        const shouldPlay =
          entry.isIntersecting && entry.intersectionRatio >= 0.4;
        const activeAudio = autoplayWithSound ? profileAudioRef.current : null;
        if (activeAudio) {
          activeAudio.setVideoVisible(video, shouldPlay);
          return;
        }
        if (shouldPlay) {
          video.muted = true;
          void video.play().catch(() => {
            if (!video.isConnected || ref.current !== video) return;
            video.muted = true;
            void video.play().catch(() => {});
          });
        } else {
          video.pause();
          video.muted = true;
        }
      },
      { threshold: [0, 0.4] },
    );
    io.observe(el);
    return () => {
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
      muted={!autoplayWithSound || !profileAudio}
      loop
      playsInline
      preload={preload}
      style={passThroughClicks ? { pointerEvents: "none" } : undefined}
    />
  );
}
