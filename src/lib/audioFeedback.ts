type FeedbackTone = "pop" | "swoosh" | "send" | "receive" | "delete";

let audioContext: AudioContext | null = null;
let suspendTimer: ReturnType<typeof setTimeout> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContext) audioContext = new AudioContextCtor();
  return audioContext;
}

function scheduleSuspend(ctx: AudioContext) {
  if (suspendTimer) clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => {
    if (ctx.state === "running") void ctx.suspend().catch(() => {});
  }, 1000);
}

export function playFeedbackTone(type: FeedbackTone) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (suspendTimer) clearTimeout(suspendTimer);
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const duration =
      type === "send" ? 0.18 :
      type === "receive" ? 0.28 :
      type === "delete" ? 0.3 :
      type === "swoosh" ? 0.18 : 0.13;

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "pop") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
    } else if (type === "swoosh") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1300, now + 0.07);
      gain.gain.setValueAtTime(0.13, now);
    } else if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
    } else if (type === "receive") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
      gain.gain.setValueAtTime(0.08, now);
    }

    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
    scheduleSuspend(ctx);
  } catch (_) {
    // Audio feedback is optional and must never interrupt the primary action.
  }
}