import { useEffect, useRef, useState, type RefObject } from "react";
import type Hls from "hls.js";

export const isHlsUrl = (url: unknown): url is string =>
  typeof url === "string" && /\.m3u8(?:$|[?#])/i.test(url);

export function useHlsVideo(
  videoRef: RefObject<HTMLVideoElement>,
  source: string | null | undefined,
  enabled: boolean,
  retryKey?: string,
  autoPlay = false,
  preloadOnly = false,
) {
  const isHls = isHlsUrl(source);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const autoPlayRef = useRef(autoPlay);
  const preloadOnlyRef = useRef(preloadOnly);
  const hlsRef = useRef<Hls | null>(null);
  autoPlayRef.current = autoPlay;
  preloadOnlyRef.current = preloadOnly;

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
      video.autoplay = autoPlayRef.current;
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
      .then(({ default: HlsConstructor, FetchLoader }) => {
        if (cancelled) return;
        if (!HlsConstructor.isSupported()) {
          setError("HLS playback is not supported by this browser.");
          return;
        }

        hls = new HlsConstructor({
          loader: FetchLoader,
          enableWorker: true,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 2,
          startLevel: -1,
          lowLatencyMode: true,
          maxBufferLength: preloadOnlyRef.current ? 2 : 30,
          maxMaxBufferLength: preloadOnlyRef.current ? 5 : 60,
          capLevelToPlayerSize: true,
          fetchSetup: (context, initParams) => {
            try {
              const pathname = new URL(context.url, window.location.href).pathname;
              const isMediaSegment = /\.(?:ts|m4s|mp4)(?:$|[?#])/i.test(pathname);
              return new Request(context.url, {
                ...initParams,
                ...(isMediaSegment ? { cache: "force-cache" } : {}),
              });
            } catch {
              return new Request(context.url, initParams);
            }
          },
        });
        hlsRef.current = hls;
        video.autoplay = autoPlayRef.current;
        hls.on(HlsConstructor.Events.MANIFEST_PARSED, () => {
          if (autoPlayRef.current) void video.play().catch(() => {});
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
      if (hlsRef.current === hls) hlsRef.current = null;
      video.autoplay = false;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [enabled, isHls, retryKey, retryToken, source, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isHls || !enabled) return;
    video.autoplay = autoPlay;
    const hls = hlsRef.current;
    if (hls) {
      hls.config.maxBufferLength = preloadOnly ? 2 : 30;
      hls.config.maxMaxBufferLength = preloadOnly ? 5 : 60;
    }
    if (autoPlay && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      void video.play().catch(() => {});
    }
  }, [autoPlay, enabled, isHls, preloadOnly, source, videoRef]);

  return {
    isHls,
    error,
    retry: () => setRetryToken((token) => token + 1),
  };
}
