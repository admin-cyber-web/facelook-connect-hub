import { useCallback } from "react";
import { playFeedbackTone } from "../lib/audioFeedback";

export function useSoundEffects() {
  const playPop = useCallback(() => {
    playFeedbackTone("pop");
  }, []);

  const playSwoosh = useCallback(() => {
    playFeedbackTone("swoosh");
  }, []);

  return { playPop, playSwoosh };
}
