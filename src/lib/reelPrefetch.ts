const MAX_ENTRIES = 6;

const preloaders = new Map<string, HTMLMediaElement>();

const isAudioUrl = (url: string) => /\.(mp3|m4a|aac|ogg|wav)(?:$|[?#])/i.test(url);

function evictIfNeeded() {
  while (preloaders.size > MAX_ENTRIES) {
    const oldestUrl = preloaders.keys().next().value;
    if (!oldestUrl) return;
    const element = preloaders.get(oldestUrl);
    if (element) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    preloaders.delete(oldestUrl);
  }
}

/** Warm browser media buffering without downloading full files into JavaScript memory. */
export function prefetchReelMedia(
  url: string | null | undefined,
  _priority: "high" | "normal" = "normal",
): void {
  if (
    !url ||
    typeof url !== "string" ||
    !/^https?:\/\//i.test(url) ||
    /\.m3u8(?:$|[?#])/i.test(url)
  ) return;
  if (preloaders.has(url) || typeof document === "undefined") return;

  const element: HTMLMediaElement = isAudioUrl(url)
    ? new Audio()
    : document.createElement("video");
  element.preload = "auto";
  element.crossOrigin = "anonymous";
  if (element instanceof HTMLVideoElement) {
    element.muted = true;
    element.playsInline = true;
  }
  element.src = url;
  preloaders.set(url, element);
  evictIfNeeded();
  element.load();
}
