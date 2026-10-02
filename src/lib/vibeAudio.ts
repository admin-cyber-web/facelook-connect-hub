export interface VibeAudioState {
  enabled: boolean;
  playing: boolean;
  awaitingGesture: boolean;
  activePostId: string | null;
  activeUrl: string | null;
  activeLoop: boolean;
  failed: boolean;
}

let state: VibeAudioState = {
  enabled: false,
  playing: false,
  awaitingGesture: false,
  activePostId: null,
  activeUrl: null,
  activeLoop: true,
  failed: false,
};
let player: HTMLAudioElement | null = null;
let documentListenersInstalled = false;
let playGeneration = 0;
let userMuted = false;
let lastScrollRetryAt = 0;
const listeners = new Set<() => void>();
const visiblePosts = new Map<
  string,
  { url: string | null; loop: boolean; ratio: number }
>();

const publish = (next: VibeAudioState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const pausePlayer = () => {
  playGeneration += 1;
  player?.pause();
};

const getMostVisiblePost = () => {
  let best: {
    postId: string;
    url: string | null;
    loop: boolean;
    ratio: number;
  } | null = null;

  visiblePosts.forEach((post, postId) => {
    if (
      !best ||
      post.ratio > best.ratio ||
      (post.ratio === best.ratio && postId === state.activePostId)
    ) {
      best = { postId, ...post };
    }
  });
  return best;
};

const syncVisiblePost = () => {
  const candidate = getMostVisiblePost();
  const nextPostId = candidate?.postId ?? null;
  const nextUrl = candidate?.url ?? null;
  const nextLoop = candidate?.loop ?? true;
  const trackChanged =
    state.activePostId !== nextPostId ||
    state.activeUrl !== nextUrl ||
    state.activeLoop !== nextLoop;

  if (!trackChanged) return;

  pausePlayer();
  const shouldPlay = Boolean(nextUrl) && !userMuted;
  publish({
    ...state,
    enabled: shouldPlay,
    playing: false,
    awaitingGesture: false,
    activePostId: nextPostId,
    activeUrl: nextUrl,
    activeLoop: nextLoop,
    failed: false,
  });
  if (shouldPlay) void playCurrentTrack();
};

const getPlayer = (): HTMLAudioElement | null => {
  if (typeof Audio === "undefined") return null;
  if (!player) {
    player = new Audio();
    player.loop = true;
    player.preload = "auto";
    player.volume = 0.35;
    player.muted = false;
    player.addEventListener("ended", () => {
      if (!state.activeLoop && state.enabled) {
        publish({
          ...state,
          enabled: false,
          playing: false,
          awaitingGesture: false,
          failed: false,
        });
      }
    });
    if (typeof document !== "undefined" && !documentListenersInstalled) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          pausePlayer();
          if (state.playing) publish({ ...state, playing: false });
        } else if (state.enabled && state.activeUrl) {
          void playCurrentTrack();
        }
      });

      const retryFromUserGesture = (event: Event) => {
        if (
          !state.enabled ||
          !state.activeUrl ||
          !player?.paused ||
          (typeof document !== "undefined" &&
            document.visibilityState === "hidden")
        ) {
          return;
        }

        const target = event.target;
        if (
          typeof Element !== "undefined" &&
          target instanceof Element &&
          target.closest('[data-testid^="button-vibe-audio-"]')
        ) {
          return;
        }

        if (event.type === "scroll" || event.type === "wheel") {
          const now = Date.now();
          if (now - lastScrollRetryAt < 220) return;
          lastScrollRetryAt = now;
        }

        // Calling play() in the event handler preserves the browser's transient
        // user activation on iOS Safari, Android WebView, and desktop browsers.
        void playCurrentTrack();
      };

      document.addEventListener("pointerdown", retryFromUserGesture, {
        capture: true,
        passive: true,
      });
      document.addEventListener("touchstart", retryFromUserGesture, {
        capture: true,
        passive: true,
      });
      document.addEventListener("wheel", retryFromUserGesture, {
        capture: true,
        passive: true,
      });
      document.addEventListener("scroll", retryFromUserGesture, {
        capture: true,
        passive: true,
      });
      document.addEventListener("keydown", retryFromUserGesture, true);
      documentListenersInstalled = true;
    }
  }
  return player;
};

const playCurrentTrack = async (): Promise<boolean> => {
  const current = getPlayer();
  if (!current || !state.activeUrl || !state.enabled) return false;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    pausePlayer();
    return false;
  }

  const attempt = ++playGeneration;
  const expectedPostId = state.activePostId;
  const expectedUrl = state.activeUrl;

  try {
    if (current.getAttribute("src") !== state.activeUrl) {
      current.pause();
      current.currentTime = 0;
      current.src = state.activeUrl;
      current.load();
    }
    current.loop = state.activeLoop;
    current.muted = false;
    try {
      current.volume = 0.35;
    } catch {
      // Some mobile WebViews leave volume control to the device audio session.
    }
    await current.play();
    if (
      attempt !== playGeneration ||
      state.activePostId !== expectedPostId ||
      state.activeUrl !== expectedUrl ||
      !state.enabled
    ) {
      return false;
    }
    publish({
      ...state,
      playing: true,
      awaitingGesture: false,
      failed: false,
    });
    return true;
  } catch (error) {
    if (
      attempt !== playGeneration ||
      state.activePostId !== expectedPostId ||
      state.activeUrl !== expectedUrl
    ) {
      return false;
    }
    try {
      current.pause();
    } catch {
      // Keep playback-policy failures from escaping into the feed UI.
    }
    const errorName = (error as DOMException | undefined)?.name;
    const awaitingGesture =
      errorName === "NotAllowedError" || errorName === "AbortError";
    publish({
      ...state,
      playing: false,
      awaitingGesture,
      failed: !awaitingGesture,
    });
    return false;
  }
};

export function subscribeVibeAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVibeAudioSnapshot(): VibeAudioState {
  return state;
}

export function setVisibleVibeAudio(
  postId: string,
  url: string | null,
  visible: boolean,
  loop = true,
  visibilityRatio = visible ? 1 : 0,
): void {
  if (visible) {
    visiblePosts.set(postId, {
      url,
      loop,
      ratio: Math.max(0, Math.min(1, visibilityRatio)),
    });
  } else {
    visiblePosts.delete(postId);
  }
  syncVisiblePost();
}

export async function toggleVibeAudioForPost(
  postId: string,
  url: string,
  loop = true,
): Promise<boolean> {
  if (
    state.activePostId === postId &&
    state.activeUrl === url &&
    state.playing &&
    player &&
    !player.paused
  ) {
    userMuted = true;
    pausePlayer();
    publish({
      ...state,
      enabled: false,
      playing: false,
      awaitingGesture: false,
      failed: false,
    });
    return true;
  }

  userMuted = false;
  pausePlayer();
  publish({
    ...state,
    enabled: true,
    playing: false,
    awaitingGesture: false,
    activePostId: postId,
    activeUrl: url,
    activeLoop: loop,
    failed: false,
  });
  return playCurrentTrack();
}