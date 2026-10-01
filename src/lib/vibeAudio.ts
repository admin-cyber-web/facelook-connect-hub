export interface VibeAudioState {
  enabled: boolean;
  activePostId: string | null;
  activeUrl: string | null;
  activeLoop: boolean;
  failed: boolean;
}

let state: VibeAudioState = {
  enabled: false,
  activePostId: null,
  activeUrl: null,
  activeLoop: true,
  failed: false,
};
let player: HTMLAudioElement | null = null;
let visibilityListenerInstalled = false;
let playGeneration = 0;
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
  publish({
    ...state,
    activePostId: nextPostId,
    activeUrl: nextUrl,
    activeLoop: nextLoop,
    failed: false,
  });
  if (state.enabled && nextUrl) void playCurrentTrack();
};

const getPlayer = (): HTMLAudioElement | null => {
  if (typeof Audio === "undefined") return null;
  if (!player) {
    player = new Audio();
    player.loop = true;
    player.preload = "none";
    player.volume = 0.35;
    player.addEventListener("ended", () => {
      if (!state.activeLoop && state.enabled) {
        publish({ ...state, enabled: false, failed: false });
      }
    });
    if (typeof document !== "undefined" && !visibilityListenerInstalled) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          pausePlayer();
        } else if (state.enabled && state.activeUrl) {
          void playCurrentTrack();
        }
      });
      visibilityListenerInstalled = true;
    }
  }
  return player;
};

const playCurrentTrack = async (manualAttempt = false): Promise<boolean> => {
  const current = getPlayer();
  if (!current || !state.activeUrl || !state.enabled) return false;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    pausePlayer();
    return false;
  }

  const attempt = ++playGeneration;
  const expectedPostId = state.activePostId;
  const expectedUrl = state.activeUrl;
  if (current.getAttribute("src") !== state.activeUrl) {
    current.pause();
    current.currentTime = 0;
    current.src = state.activeUrl;
    current.load();
  }
  current.loop = state.activeLoop;

  try {
    await current.play();
    if (
      attempt !== playGeneration ||
      state.activePostId !== expectedPostId ||
      state.activeUrl !== expectedUrl ||
      !state.enabled
    ) {
      return false;
    }
    publish({ ...state, failed: false });
    return true;
  } catch {
    if (
      attempt !== playGeneration ||
      state.activePostId !== expectedPostId ||
      state.activeUrl !== expectedUrl
    ) {
      return false;
    }
    current.pause();
    publish({
      ...state,
      enabled: manualAttempt ? false : state.enabled,
      failed: true,
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
  if (state.enabled && state.activePostId === postId) {
    pausePlayer();
    publish({ ...state, enabled: false, failed: false });
    return true;
  }

  pausePlayer();
  publish({
    ...state,
    enabled: true,
    activePostId: postId,
    activeUrl: url,
    activeLoop: loop,
    failed: false,
  });
  return playCurrentTrack(true);
}