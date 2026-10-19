import { useEffect, useRef } from "react";

interface Props {
  src: string;
  className?: string;
  poster?: string;
  ariaLabel?: string;
  controls?: boolean;
  preload?: "none" | "metadata" | "auto";
  /** When true, parent's onClick still fires (default).  */
  passThroughClicks?: boolean;
}

/**
 * FB-style auto-play video tile:
 *   • muted while in viewport, plays silently
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
  passThroughClicks = true,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const video = ref.current;
        if (!entry || !video) return;
        const shouldPlay =
          entry.isIntersecting && entry.intersectionRatio >= 0.4;
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
      el.pause();
      el.muted = true;
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className={className}
      aria-label={ariaLabel}
      controls={controls}
      muted
      loop
      playsInline
      preload={preload}
      style={passThroughClicks ? { pointerEvents: "none" } : undefined}
    />
  );
}
