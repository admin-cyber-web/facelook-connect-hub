import { useEffect, useState, type RefObject } from "react";
import type Hls from "hls.js";

export const isHlsUrl = (url: unknown): url is string =>
  typeof url === "string" && /\.m3u8(?:$|[?#])/i.test(url);

export function useHlsVideo(
  videoRef: RefObject<HTMLVideoElement>,
  source: string | null | undefined,
  enabled: boolean,
  retryKey?: string,
  autoPlay = false,
) {
  const isHls = isHlsUrl(source);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isHls || !source || !enabled) {
      setError(null);
      return;
    }

    let networkRetryUsed = false;
    let mediaRecoveryUsed = false;
    setError(null);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.autoplay = autoPlay;
      video.src = source;
      return () => {
        video.autoplay = false;
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    let cancelled = false;
    let hls: Hls | null = null;
    void import("hls.js")
      .then(({ default: HlsConstructor }) => {
        if (cancelled) return;
        if (!HlsConstructor.isSupported()) {
          setError("HLS playback is not supported by this browser.");
          return;
        }

        hls = new HlsConstructor({
          enableWorker: true,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 2,
        });
        video.autoplay = autoPlay;
        hls.on(HlsConstructor.Events.MANIFEST_PARSED, () => {
          if (autoPlay) void video.play().catch(() => {});
        });
        hls.on(HlsConstructor.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === HlsConstructor.ErrorTypes.NETWORK_ERROR && !networkRetryUsed) {
            networkRetryUsed = true;
            hls?.startLoad();
            return;
          }
          if (data.type === HlsConstructor.ErrorTypes.MEDIA_ERROR && !mediaRecoveryUsed) {
            mediaRecoveryUsed = true;
            hls?.recoverMediaError();
            return;
          }
          setError("This HLS video couldn't be loaded. Please try again.");
        });
        hls.loadSource(source);
        hls.attachMedia(video);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        console.error("[HLS] Could not load the playback library:", loadError);
        setError("HLS playback could not be initialized. Please try again.");
      });

    return () => {
      cancelled = true;
      hls?.destroy();
      video.autoplay = false;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [autoPlay, enabled, isHls, retryKey, retryToken, source, videoRef]);

  return {
    isHls,
    error,
    retry: () => setRetryToken((token) => token + 1),
  };
}
