import { useSyncExternalStore, type MouseEvent } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  getVibeAudioSnapshot,
  subscribeVibeAudio,
  toggleVibeAudioForPost,
} from "../lib/vibeAudio";

interface VibeAudioToggleProps {
  postId: string;
  audioUrl: string;
  audioTitle?: string;
  audioLoop?: boolean;
  compact?: boolean;
}

export default function VibeAudioToggle({
  postId,
  audioUrl,
  audioTitle,
  audioLoop = true,
  compact = false,
}: VibeAudioToggleProps) {
  const audioState = useSyncExternalStore(
    subscribeVibeAudio,
    getVibeAudioSnapshot,
    getVibeAudioSnapshot,
  );
  const isActivePost = audioState.activePostId === postId;
  const isPlaying = isActivePost && audioState.playing && audioState.enabled;
  const isWaitingForGesture =
    isActivePost && audioState.awaitingGesture && audioState.enabled;

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    // The manager calls play() synchronously from this user gesture so browsers
    // that blocked autoplay can start the track immediately and unmuted.
    void toggleVibeAudioForPost(postId, audioUrl, audioLoop);
  };

  const label = isPlaying ? "Mute ambient audio" : "Play ambient audio";
  return (
    <button
      type="button"
      data-testid={`button-vibe-audio-${postId}`}
      onClick={toggle}
      aria-label={label}
      aria-pressed={isPlaying}
      title={`${label}${audioTitle ? ` — ${audioTitle}` : ""}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border transition-colors ${
        compact
          ? "h-7 w-7 border-white/15 bg-black/35 text-white/80 hover:bg-white/15"
          : "gap-1.5 border-white/15 bg-black/35 px-2.5 py-1 text-[10px] font-bold text-white/85 hover:bg-white/15"
      } ${isPlaying ? "border-cyan-300/60 text-cyan-200" : ""}`}
    >
      {isPlaying ? <Volume2 size={compact ? 13 : 12} /> : <VolumeX size={compact ? 13 : 12} />}
      {!compact && (
        <span>
          {isPlaying ? "Audio on" : isWaitingForGesture ? "Tap audio" : "Audio"}
        </span>
      )}
    </button>
  );
}