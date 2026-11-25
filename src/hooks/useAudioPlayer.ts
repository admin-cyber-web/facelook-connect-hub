import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Audio player hook that prevents "audio resource abort DOMException" errors.
 * 
 * When the audio src is updated, we wait for the loadedmetadata/canplay events
 * before playing, and we properly handle the play promise to catch AbortError.
 */
export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const handleCanPlayRef = useRef<() => void>();
  const handleLoadedMetaRef = useRef<() => void>();

  // Set the audio element ref
  const setAudioElement = useCallback((element: HTMLAudioElement | null) => {
    audioRef.current = element;
  }, []);

  // Play audio with proper error handling
  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Wait for loadedmetadata or canplay event before playing
    // This prevents the "Network error" or "AbortError" when src changes
    const handleCanPlay = () => {
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("loadedmetadata", handleLoadedMeta);
      playAudio();
    };

    const handleLoadedMeta = () => {
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("loadedmetadata", handleLoadedMeta);
      playAudio();
    };

    handleCanPlayRef.current = handleCanPlay;
    handleLoadedMetaRef.current = handleLoadedMeta;

    const playAudio = () => {
      audio.play().catch((err) => {
        // Only log if it's not an AbortError (which is expected when src changes)
        if (err.name !== "AbortError") {
          setError(err);
          console.error("Audio playback error:", err);
        }
      });
      setIsPlaying(true);
    };

    // Add event listeners once, wait for them to trigger
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadedmetadata", handleLoadedMeta);
  }, []);

  // Reset when src changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      // Remove existing event listeners to prevent duplicates
      if (handleCanPlayRef.current) {
        audio.removeEventListener("canplay", handleCanPlayRef.current);
      }
      if (handleLoadedMetaRef.current) {
        audio.removeEventListener("loadedmetadata", handleLoadedMetaRef.current);
      }
      setIsPlaying(false);
      setError(null);
    }
    return () => {
      if (audio) {
        if (handleCanPlayRef.current) {
          audio.removeEventListener("canplay", handleCanPlayRef.current);
        }
        if (handleLoadedMetaRef.current) {
          audio.removeEventListener("loadedmetadata", handleLoadedMetaRef.current);
        }
      }
    };
  }, []);

  return {
    audioRef,
    setAudioElement,
    play,
    isPlaying,
    error,
  };
}