import { useSyncExternalStore, type MouseEvent } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import {
  getVibeAudioSnapshot,
  subscribeVibeAudio,
  toggleVibeAudioForPost,
} from "../lib/vibeAudio";

interface VibeAudioToggleProps {
  postId: string;
  audioUrl: string;
  vibeLabel: string;
  audioTitle?: string;
  compact?: boolean;
}

export default function VibeAudioToggle({
  postId,
  audioUrl,
  vibeLabel,
  audioTitle,
  compact = false,
}: VibeAudioToggleProps) {
  const audioState = useSyncExternalStore(
    subscribeVibeAudio,
    getVibeAudioSnapshot,
    getVibeAudioSnapshot,
  );
  const isPlaying = audioState.enabled && audioState.activePostId === postId;

  const toggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const didPlay = await toggleVibeAudioForPost(postId, audioUrl);
    if (!didPlay) toast.error("Could not play this vibe audio. Tap to try again.");
  };

  const label = isPlaying ? `Turn off ${vibeLabel} audio` : `Play ${vibeLabel} audio`;
  return (
    <button
      type="button"
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
      {!compact && <span>{isPlaying ? "Audio on" : "Audio"}</span>}
    </button>
  );
}