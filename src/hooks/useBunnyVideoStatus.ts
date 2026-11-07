import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export type BunnyVideoStatusState = {
  phase: "idle" | "checking" | "processing" | "ready" | "failed";
  progress: number | null;
  message: string | null;
};

const POLL_INTERVAL_MS = 4_000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1_000;
const readyVideoIds = new Set<string>();

export function getBunnyVideoId(url: string, explicitId?: unknown): string | null {
  if (typeof explicitId === "string" && /^[\w-]{8,64}$/.test(explicitId)) {
    return explicitId;
  }
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith(".b-cdn.net")) return null;
    const match = parsedUrl.pathname.match(/^\/([\w-]{8,64})\/playlist\.m3u8$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function getBunnyVideoThumbnailUrl(source: string, fallback?: string | null): string | undefined {
  if (fallback) return fallback;
  try {
    const parsedUrl = new URL(source);
    if (!parsedUrl.hostname.endsWith(".b-cdn.net")) return undefined;
    const match = parsedUrl.pathname.match(/^\/([\w-]{8,64})\/playlist\.m3u8$/i);
    if (!match) return undefined;
    return `${parsedUrl.origin}/${match[1]}/thumbnail.jpg`;
  } catch {
    return undefined;
  }
}

export function useBunnyVideoStatus(videoId: string | null, enabled: boolean) {
  const [state, setState] = useState<BunnyVideoStatusState>(() => ({
    phase: videoId && readyVideoIds.has(videoId) ? "ready" : "idle",
    progress: videoId && readyVideoIds.has(videoId) ? 100 : null,
    message: null,
  }));
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => setRetryToken((token) => token + 1), []);

  useEffect(() => {
    if (!enabled || !videoId) {
      setState({
        phase: videoId && readyVideoIds.has(videoId) ? "ready" : "idle",
        progress: videoId && readyVideoIds.has(videoId) ? 100 : null,
        message: null,
      });
      return;
    }

    if (readyVideoIds.has(videoId)) {
      setState({ phase: "ready", progress: 100, message: null });
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= MAX_POLL_DURATION_MS) {
        setState({
          phase: "failed",
          progress: null,
          message: "Video encoding is taking longer than expected. Please try again later.",
        });
        return;
      }

      setState((current) => ({
        ...current,
        phase: current.phase === "idle" ? "checking" : current.phase,
        message: null,
      }));

      try {
        const response = await fetch(apiUrl("/api/videos/status"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || `Video status check failed (${response.status})`);
        }
        if (cancelled) return;
        if (result.failed) {
          setState({
            phase: "failed",
            progress: null,
            message: result.message || "Bunny Stream could not encode this video.",
          });
          return;
        }
        if (result.ready) {
          readyVideoIds.add(videoId);
          setState({ phase: "ready", progress: 100, message: null });
          return;
        }
        setState({
          phase: "processing",
          progress: typeof result.encodeProgress === "number" ? result.encodeProgress : null,
          message: null,
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          phase: "failed",
          progress: null,
          message: error instanceof Error ? error.message : "Could not check video processing status.",
        });
        return;
      }

      timeout = setTimeout(poll, POLL_INTERVAL_MS);
    };

    setState({ phase: "checking", progress: null, message: null });
    void poll();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [enabled, retryToken, videoId]);

  return { ...state, retry };
}
