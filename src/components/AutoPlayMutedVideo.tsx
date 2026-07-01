import { useEffect, useRef } from "react";

interface Props {
  src: string;
  className?: string;
  poster?: string;
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
export default function AutoPlayMutedVideo({ src, className, poster, passThroughClicks = true }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = ref.current;
        if (!v) return;
        if (entry.isIntersecting) {
          v.muted = true;
          const p = v.play();
          if (p && typeof (p as any).catch === "function") (p as Promise<void>).catch(() => {});
        } else {
          v.pause();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className={className}
      muted
      loop
      playsInline
      preload="metadata"
      style={passThroughClicks ? { pointerEvents: "none" } : undefined}
    />
  );
}
