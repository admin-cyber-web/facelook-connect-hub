import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Volume2, VolumeX } from "lucide-react";

type ProfileTimelineAudioContextValue = {
  soundEnabled: boolean;
  needsGesture: boolean;
  registerVideo: (video: HTMLVideoElement) => () => void;
  setVideoVisible: (video: HTMLVideoElement, visible: boolean) => void;
  muteVideos: () => void;
  retryWithSound: () => void;
};

const ProfileTimelineAudioContext =
  createContext<ProfileTimelineAudioContextValue | null>(null);

export function useProfileTimelineAudio() {
  return useContext(ProfileTimelineAudioContext);
}

export function ProfileTimelineAudioProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [needsGesture, setNeedsGesture] = useState(false);
  const soundEnabledRef = useRef(true);
  const visibleVideos = useRef(new Map<HTMLVideoElement, boolean>());

  const registerVideo = useCallback((video: HTMLVideoElement) => {
    visibleVideos.current.set(video, false);
    return () => {
      visibleVideos.current.delete(video);
      video.pause();
      video.muted = true;
    };
  }, []);

  const setVideoVisible = useCallback(
    (video: HTMLVideoElement, visible: boolean) => {
      if (!visibleVideos.current.has(video)) return;
      visibleVideos.current.set(video, visible);
      if (!visible) {
        video.pause();
        video.muted = true;
        return;
      }

      video.muted = !soundEnabledRef.current;
      void video.play().catch((error: unknown) => {
        if (
          video.isConnected &&
          visibleVideos.current.get(video) &&
          soundEnabledRef.current &&
          error instanceof Error &&
          error.name === "NotAllowedError"
        ) {
          setNeedsGesture(true);
        }
      });
    },
    [],
  );

  const muteVideos = useCallback(() => {
    soundEnabledRef.current = false;
    setSoundEnabled(false);
    setNeedsGesture(false);
    for (const [video, visible] of visibleVideos.current) {
      if (visible) video.muted = true;
    }
  }, []);

  const retryWithSound = useCallback(() => {
    soundEnabledRef.current = true;
    setSoundEnabled(true);

    const attempts = [...visibleVideos.current.entries()]
      .filter(([, visible]) => visible)
      .map(([video]) => {
        video.muted = false;
        try {
          return video.play().then(
            () => false,
            (error: unknown) =>
              error instanceof Error && error.name === "NotAllowedError",
          );
        } catch (error) {
          return Promise.resolve(
            error instanceof Error && error.name === "NotAllowedError",
          );
        }
      });

    if (attempts.length === 0) {
      setNeedsGesture(false);
      return;
    }

    void Promise.all(attempts).then((results) => {
      setNeedsGesture(results.some(Boolean));
    });
  }, []);

  const value = useMemo(
    () => ({
      soundEnabled,
      needsGesture,
      registerVideo,
      setVideoVisible,
      muteVideos,
      retryWithSound,
    }),
    [
      soundEnabled,
      needsGesture,
      registerVideo,
      setVideoVisible,
      muteVideos,
      retryWithSound,
    ],
  );

  return (
    <ProfileTimelineAudioContext.Provider value={value}>
      {children}
    </ProfileTimelineAudioContext.Provider>
  );
}

export function ProfileTimelineSoundControl() {
  const audio = useProfileTimelineAudio();
  if (!audio) return null;

  const { soundEnabled, needsGesture, muteVideos, retryWithSound } = audio;
  const shouldRetry = needsGesture || !soundEnabled;
  const label = needsGesture
    ? "Tap to enable sound"
    : soundEnabled
      ? "Sound on"
      : "Sound off";

  return (
    <div className="flex justify-end px-4 pb-3 sm:px-5">
      <button
        type="button"
        onClick={shouldRetry ? retryWithSound : muteVideos}
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3.5 text-xs font-bold text-white/85 shadow-sm backdrop-blur transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        aria-label={
          needsGesture
            ? "Tap to enable sound for profile videos"
            : soundEnabled
              ? "Mute profile videos"
              : "Enable sound for profile videos"
        }
        aria-live="polite"
        data-testid="button-profile-video-sound"
      >
        {soundEnabled ? (
          <Volume2 size={15} aria-hidden="true" />
        ) : (
          <VolumeX size={15} aria-hidden="true" />
        )}
        {label}
      </button>
    </div>
  );
}
