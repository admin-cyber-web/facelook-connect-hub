export interface VibeAudioState {
  enabled: boolean;
  activePostId: string | null;
  activeUrl: string | null;
  failed: boolean;
}

let state: VibeAudioState = {
  enabled: false,
  activePostId: null,
  activeUrl: null,
  failed: false,
};
let player: HTMLAudioElement | null = null;
let visibilityListenerInstalled = false;
const listeners = new Set<() => void>();

const publish = (next: VibeAudioState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const getPlayer = (): HTMLAudioElement | null => {
  if (typeof Audio === "undefined") return null;
  if (!player) {
    player = new Audio();
    player.loop = true;
    player.preload = "none";
    player.volume = 0.35;
    if (typeof document !== "undefined" && !visibilityListenerInstalled) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          player?.pause();
        } else if (state.enabled && state.activeUrl) {
          void playCurrentTrack();
        }
      });
      visibilityListenerInstalled = true;
    }
  }
  return player;
};

const playCurrentTrack = async (): Promise<boolean> => {
  const current = getPlayer();
  if (!current || !state.activeUrl) return false;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    current.pause();
    return false;
  }

  if (current.getAttribute("src") !== state.activeUrl) {
    current.pause();
    current.currentTime = 0;
    current.src = state.activeUrl;
    current.load();
  }

  try {
    await current.play();
    publish({ ...state, failed: false });
    return true;
  } catch {
    current.pause();
    publish({ ...state, enabled: false, failed: true });
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
): void {
  if (visible && url) {
    const trackChanged = state.activePostId !== postId || state.activeUrl !== url;
    if (trackChanged) {
      publish({ ...state, activePostId: postId, activeUrl: url, failed: false });
      if (state.enabled) void playCurrentTrack();
    }
    return;
  }

  if (state.activePostId === postId) {
    player?.pause();
    publish({ ...state, activePostId: null, activeUrl: null });
  }
}

export async function toggleVibeAudioForPost(
  postId: string,
  url: string,
): Promise<boolean> {
  if (state.enabled && state.activePostId === postId) {
    player?.pause();
    publish({ ...state, enabled: false, failed: false });
    return true;
  }

  publish({
    ...state,
    enabled: true,
    activePostId: postId,
    activeUrl: url,
    failed: false,
  });
  return playCurrentTrack();
}