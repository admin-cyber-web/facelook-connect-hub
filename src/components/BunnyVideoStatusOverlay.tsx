import { Loader2, RotateCw } from "lucide-react";
import type { BunnyVideoStatusState } from "@/hooks/useBunnyVideoStatus";

interface Props {
  state: BunnyVideoStatusState;
  onRetry: () => void;
  className?: string;
}

export default function BunnyVideoStatusOverlay({ state, onRetry, className = "" }: Props) {
  if (state.phase !== "checking" && state.phase !== "processing" && state.phase !== "failed") {
    return null;
  }

  const isFailed = state.phase === "failed";
  return (
    <div className={`absolute inset-0 z-[25] flex flex-col items-center justify-center gap-3 bg-[#090b14]/95 px-6 text-center ${className}`}>
      {isFailed ? (
        <span className="text-3xl" aria-hidden="true">⚠️</span>
      ) : (
        <Loader2 className="animate-spin text-cyan-300" size={28} aria-hidden="true" />
      )}
      <p className="text-sm font-bold text-white">
        {isFailed
          ? "Video isn't ready"
          : state.phase === "checking"
            ? "Checking video status..."
            : "Processing video..."}
      </p>
      {state.progress !== null && !isFailed && (
        <div className="w-full max-w-48">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-cyan-300 transition-[width]" style={{ width: `${Math.min(100, Math.max(0, state.progress))}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-white/60">{Math.round(state.progress)}%</p>
        </div>
      )}
      {state.message && <p className="max-w-64 text-xs text-white/65">{state.message}</p>}
      {isFailed && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRetry();
          }}
          className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white"
        >
          <RotateCw size={14} /> Check again
        </button>
      )}
    </div>
  );
}
