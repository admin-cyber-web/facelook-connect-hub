import { useCallback } from "react";

let sharedContext: AudioContext | null = null;
let suspendTimer: ReturnType<typeof setTimeout> | null = null;

const getContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioContextCtor();
  }
  if (suspendTimer) {
    clearTimeout(suspendTimer);
    suspendTimer = null;
  }
  if (sharedContext.state === "suspended") {
    void sharedContext.resume().catch(() => {});
  }
  return sharedContext;
};

const suspendWhenIdle = () => {
  if (suspendTimer) clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => {
    if (sharedContext?.state === "running") {
      void sharedContext.suspend().catch(() => {});
    }
    suspendTimer = null;
  }, 1200);
};

const playTone = (
  frequency: number,
  endFrequency: number,
  gainValue: number,
  duration: number,
) => {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration * 0.6);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      suspendWhenIdle();
    };
    osc.start(now);
    osc.stop(now + duration);
  } catch (_) {
    suspendWhenIdle();
  }
};

export function useSoundEffects() {
  const playPop = useCallback(() => {
    playTone(1100, 500, 0.18, 0.13);
  }, []);

  const playSwoosh = useCallback(() => {
    playTone(880, 1300, 0.13, 0.18);
  }, []);

  return { playPop, playSwoosh };
}
