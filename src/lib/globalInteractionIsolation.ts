type MediaPlaybackSnapshot = {
  muted: boolean;
  volume: number;
  source: MediaProvider | string | null;
};

const ACTIVE_SURFACE_SELECTOR = [
  '[aria-modal="true"]',
  '[role="dialog"]',
  "dialog[open]",
  '[data-global-isolation="active"]',
  '[class~="fixed"]',
].join(",");

let installedCleanup: (() => void) | null = null;

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function hasViewportCoverage(element: HTMLElement) {
  if (window.getComputedStyle(element).position !== "fixed") return false;

  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const style = window.getComputedStyle(element);
  const top = Number.parseFloat(style.top);
  const bottom = Number.parseFloat(style.bottom);
  const left = Number.parseFloat(style.left);
  const right = Number.parseFloat(style.right);
  const fullHeight =
    (Number.isFinite(top) && Math.abs(top) <= 4 &&
      Number.isFinite(bottom) && Math.abs(bottom) <= 4) ||
    rect.height >= viewportHeight * 0.9;
  const fullWidth =
    (Number.isFinite(left) && Math.abs(left) <= 4 &&
      Number.isFinite(right) && Math.abs(right) <= 4) ||
    rect.width >= viewportWidth * 0.9;
  const fullHeightDrawer =
    fullHeight && rect.width >= Math.min(300, viewportWidth * 0.5);

  return fullWidth && fullHeight || fullHeightDrawer;
}

function findSurfaceRoot(element: HTMLElement) {
  if (
    element.matches("[data-global-isolation-root], [data-radix-portal]") ||
    hasViewportCoverage(element)
  ) {
    return element;
  }

  let ancestor = element.parentElement;
  while (ancestor && ancestor !== document.body) {
    if (ancestor.matches("[data-global-isolation-root], [data-radix-portal]")) {
      return ancestor;
    }
    if (hasViewportCoverage(ancestor)) return ancestor;
    ancestor = ancestor.parentElement;
  }
  return element;
}

function stackingScore(element: HTMLElement) {
  let score = 0;
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    const zIndex = Number.parseInt(window.getComputedStyle(current).zIndex, 10);
    if (Number.isFinite(zIndex)) score += zIndex;
    current = current.parentElement;
  }

  if (element.hasAttribute("data-radix-portal")) {
    const descendants = element.querySelectorAll<HTMLElement>(
      '[aria-modal="true"], [role="dialog"], [class~="fixed"]',
    );
    for (const descendant of descendants) {
      let descendantScore = 0;
      let node: HTMLElement | null = descendant;
      while (node && node !== document.body) {
        const zIndex = Number.parseInt(window.getComputedStyle(node).zIndex, 10);
        if (Number.isFinite(zIndex)) descendantScore += zIndex;
        if (node === element) break;
        node = node.parentElement;
      }
      score = Math.max(score, descendantScore);
    }
  }
  return score;
}

function getTopActiveSurface() {
  const candidates = new Set<HTMLElement>();
  const elements = document.querySelectorAll<HTMLElement>(ACTIVE_SURFACE_SELECTOR);

  for (const element of elements) {
    if (!isVisible(element)) continue;

    const isSemanticSurface =
      element.matches('[aria-modal="true"], [role="dialog"], dialog[open]') ||
      element.matches('[data-global-isolation="active"]');
    if (isSemanticSurface || hasViewportCoverage(element)) {
      candidates.add(findSurfaceRoot(element));
    }
  }

  let topSurface: HTMLElement | null = null;
  let topScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    if (!isVisible(candidate)) continue;
    const score = stackingScore(candidate);
    if (score >= topScore) {
      topSurface = candidate;
      topScore = score;
    }
  }
  return topSurface;
}

export function installGlobalInteractionIsolation() {
  if (installedCleanup) return installedCleanup;

  const previouslyInert = new Map<HTMLElement, boolean>();
  const pausedMedia = new Map<HTMLMediaElement, MediaPlaybackSnapshot>();
  const detachedAudioElements = new Set<HTMLAudioElement>();
  const playingMediaElements = new Set<HTMLMediaElement>();
  let activeSurface: HTMLElement | null = null;
  let activeMediaSurface: HTMLElement | null = null;
  let isInteractionIsolationActive = false;
  let isMediaIsolationActive = false;
  let pendingFrame = 0;
  let shouldRefreshInert = false;
  let nativeAudioConstructor: typeof Audio | null = null;

  const lockDocument = (locked: boolean) => {
    document.documentElement.classList.toggle("active-section-locked", locked);
    document.body.classList.toggle("active-section-locked", locked);
  };

  const restoreInert = () => {
    for (const [element, wasInert] of previouslyInert) {
      element.inert = wasInert;
    }
    previouslyInert.clear();
  };

  const isolateSiblings = (surface: HTMLElement) => {
    let current: HTMLElement | null = surface;
    while (current?.parentElement) {
      const parent = current.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (!(sibling instanceof HTMLElement) || sibling === current) continue;
        if (!previouslyInert.has(sibling)) {
          previouslyInert.set(sibling, sibling.inert);
        }
        sibling.inert = true;
      }
      if (parent === document.body) break;
      current = parent;
    }
  };

  const getMediaSource = (media: HTMLMediaElement) =>
    media.srcObject || media.currentSrc || media.src || null;

  const pauseAndRemember = (media: HTMLMediaElement) => {
    if (media.paused || media.ended) return;
    if (!pausedMedia.has(media)) {
      pausedMedia.set(media, {
        muted: media.muted,
        volume: media.volume,
        source: getMediaSource(media),
      });
    }
    try {
      media.pause();
    } catch {
      // Ignore media elements that became unavailable during a route change.
    }
  };

  const discardMediaTracking = (media: HTMLMediaElement) => {
    playingMediaElements.delete(media);
    if (media instanceof HTMLAudioElement && !media.isConnected) {
      detachedAudioElements.delete(media);
    }
  };

  const restoreMedia = (
    media: HTMLMediaElement,
    snapshot: MediaPlaybackSnapshot,
  ) => {
    const isDetachedAudio =
      media instanceof HTMLAudioElement && detachedAudioElements.has(media);
    if (!media.isConnected && !isDetachedAudio) {
      discardMediaTracking(media);
      return true;
    }
    if (getMediaSource(media) !== snapshot.source || media.ended) {
      discardMediaTracking(media);
      return true;
    }
    if (document.visibilityState === "hidden") return false;

    media.muted = snapshot.muted;
    media.volume = snapshot.volume;
    if (media.paused) void media.play().catch(() => {});
    return true;
  };

  const pauseOutsideSurface = (surface: HTMLElement | null) => {
    const mediaElements = new Set<HTMLMediaElement>(
      document.querySelectorAll<HTMLMediaElement>("video, audio"),
    );
    for (const media of playingMediaElements) {
      if (!media.paused && !media.ended) mediaElements.add(media);
    }
    for (const audio of detachedAudioElements) {
      if (!audio.isConnected && !audio.paused) mediaElements.add(audio);
    }

    const outsideMedia = [...mediaElements].filter(
      (media) => !surface || !surface.contains(media),
    );
    for (const media of outsideMedia) pauseAndRemember(media);
  };

  const reconcileMedia = (nextSurface: HTMLElement | null, active: boolean) => {
    if (!active) {
      for (const [media, snapshot] of [...pausedMedia.entries()]) {
        if (restoreMedia(media, snapshot)) pausedMedia.delete(media);
      }
      return;
    }

    for (const [media, snapshot] of [...pausedMedia.entries()]) {
      if (nextSurface && nextSurface.contains(media)) {
        if (restoreMedia(media, snapshot)) pausedMedia.delete(media);
      }
    }
    pauseOutsideSurface(nextSurface);
  };

  const handleMediaStart = (event: Event) => {
    const media = event.target;
    if (!(media instanceof HTMLMediaElement)) return;
    playingMediaElements.add(media);
    if (media instanceof HTMLAudioElement && !media.isConnected) {
      detachedAudioElements.add(media);
    }
    if (
      isMediaIsolationActive &&
      (!activeMediaSurface || !activeMediaSurface.contains(media))
    ) {
      pauseAndRemember(media);
    }
  };

  const handleMediaStop = (event: Event) => {
    const media = event.target;
    if (!(media instanceof HTMLMediaElement) || pausedMedia.has(media)) return;
    if (media.paused || media.ended) {
      playingMediaElements.delete(media);
      if (media instanceof HTMLAudioElement && !media.isConnected) {
        detachedAudioElements.delete(media);
      }
    }
  };

  const trackDetachedAudio = (audio: HTMLAudioElement) => {
    audio.addEventListener("play", handleMediaStart);
    audio.addEventListener("playing", handleMediaStart);
    audio.addEventListener("pause", handleMediaStop);
    audio.addEventListener("ended", handleMediaStop);
  };

  if (typeof window.Audio === "function") {
    nativeAudioConstructor = window.Audio;
    window.Audio = new Proxy(nativeAudioConstructor, {
      construct(target, args, newTarget) {
        const audio = Reflect.construct(target, args, newTarget) as HTMLAudioElement;
        trackDetachedAudio(audio);
        return audio;
      },
    }) as typeof Audio;
  }

  document.addEventListener("play", handleMediaStart, true);
  document.addEventListener("playing", handleMediaStart, true);
  document.addEventListener("pause", handleMediaStop, true);
  document.addEventListener("ended", handleMediaStop, true);

  const sync = (refreshInert = false) => {
    pendingFrame = 0;
    const nextSurface = getTopActiveSurface();
    const legacyBodyLock = document.body.classList.contains("body-locked");
    const pageMediaIsolationActive =
      document.body.dataset.globalRouteIsolation === "active" ||
      document.body.dataset.globalSectionIsolation === "active";
    const routeMediaSurface = pageMediaIsolationActive
      ? document.getElementById("root")
      : null;
    const nextMediaSurface = nextSurface || routeMediaSurface;
    const nextInteractionIsolationActive = Boolean(nextSurface || legacyBodyLock);
    const nextMediaIsolationActive = Boolean(
      nextSurface || routeMediaSurface || legacyBodyLock,
    );
    const surfaceChanged = nextSurface !== activeSurface;
    const mediaSurfaceChanged = nextMediaSurface !== activeMediaSurface;
    const interactionIsolationChanged =
      nextInteractionIsolationActive !== isInteractionIsolationActive;
    const mediaIsolationChanged =
      nextMediaIsolationActive !== isMediaIsolationActive;

    if (surfaceChanged) {
      restoreInert();
      activeSurface = nextSurface;
    }

    activeMediaSurface = nextMediaSurface;
    isInteractionIsolationActive = nextInteractionIsolationActive;
    isMediaIsolationActive = nextMediaIsolationActive;
    lockDocument(nextInteractionIsolationActive);

    if (surfaceChanged || (!nextInteractionIsolationActive && previouslyInert.size > 0)) {
      restoreInert();
    }
    if (nextSurface && (surfaceChanged || refreshInert)) {
      isolateSiblings(nextSurface);
    }
    if (
      mediaSurfaceChanged ||
      mediaIsolationChanged ||
      refreshInert
    ) {
      reconcileMedia(nextMediaSurface, nextMediaIsolationActive);
    }
  };

  const scheduleSync = (refreshInert = false) => {
    shouldRefreshInert ||= refreshInert;
    if (pendingFrame) return;
    pendingFrame = window.requestAnimationFrame(() => {
      const refresh = shouldRefreshInert;
      shouldRefreshInert = false;
      sync(refresh);
    });
  };

  const observer = new MutationObserver((records) => {
    scheduleSync(records.some((record) => record.type === "childList"));
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "aria-modal",
      "class",
      "data-global-isolation",
      "data-global-isolation-root",
      "data-global-section-isolation",
      "data-global-route-isolation",
      "hidden",
      "open",
      "role",
      "style",
    ],
  });

  const handleResize = () => scheduleSync(true);
  const handleVisibilityChange = () => {
    if (document.visibilityState !== "hidden") {
      reconcileMedia(activeMediaSurface, isMediaIsolationActive);
    }
  };
  window.addEventListener("resize", handleResize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  sync(true);

  const cleanup = () => {
    observer.disconnect();
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("play", handleMediaStart, true);
    document.removeEventListener("playing", handleMediaStart, true);
    document.removeEventListener("pause", handleMediaStop, true);
    document.removeEventListener("ended", handleMediaStop, true);
    if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
    restoreInert();
    reconcileMedia(null, false);
    lockDocument(false);
    if (nativeAudioConstructor && window.Audio !== nativeAudioConstructor) {
      window.Audio = nativeAudioConstructor;
    }
    installedCleanup = null;
  };

  installedCleanup = cleanup;
  return cleanup;
}
