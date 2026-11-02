import type { BunnyVideoStatusState } from "@/hooks/useBunnyVideoStatus";

interface Props {
  state: BunnyVideoStatusState;
  className?: string;
  uploadProgress?: number | null;
}

export default function BunnyCreatorProcessingOverlay({
  state,
  className = "",
  uploadProgress = null,
}: Props) {
  const isUploading = uploadProgress !== null;
  if (!isUploading && state.phase !== "checking" && state.phase !== "processing") return null;
  const progress = isUploading ? uploadProgress : state.progress;
  const progressPercent = progress === null ? null : Math.min(100, Math.max(0, progress));
  const progressText = isUploading
    ? `Uploading video · ${Math.round(progressPercent ?? 0)}% complete`
    : progressPercent === null
      ? "Preparing high-definition optimization..."
      : `High-definition scanning and encoding · ${Math.round(progressPercent)}% complete`;

  return (
    <div className={`absolute inset-0 z-[25] flex flex-col items-center justify-center overflow-hidden bg-[#080711]/95 px-7 text-center ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(108,55,164,0.28),transparent_58%)]" />
      <style>{`
        @keyframes bunny-spider-sway {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(13px) rotate(5deg); }
        }
        @keyframes bunny-web-pulse {
          0%, 100% { opacity: .35; }
          50% { opacity: .8; }
        }
      `}</style>
      <svg
        viewBox="0 0 180 190"
        className="relative mb-5 h-44 w-44 overflow-visible"
        role="img"
        aria-label="Spider hanging from a web"
      >
        <g fill="none" stroke="rgba(215,195,255,.55)" strokeWidth="1">
          <path d="M90 0v34M90 34L22 12M90 34L42 52M90 34L70 68M90 34L110 68M90 34l48 18M90 34l68-22" />
          <path d="M22 12L42 52 70 68 90 72l20-4 28-16 20-40M42 52l28 16m40 0 28-16M70 68l20 4 20-4" />
        </g>
        <path d="M90 0v93" stroke="rgba(226,211,255,.75)" strokeWidth="1.5" />
        <g style={{ transformOrigin: "90px 108px", animation: "bunny-spider-sway 2.4s ease-in-out infinite" }}>
          <ellipse cx="90" cy="108" rx="8" ry="11" fill="#a78bfa" />
          <circle cx="90" cy="96" r="6" fill="#c4b5fd" />
          <g fill="none" stroke="#c4b5fd" strokeLinecap="round" strokeWidth="2">
            <path d="M85 102l-10-8-7 1M84 107l-12-2-6 5M85 112l-10 6-7-1M95 102l10-8 7 1M96 107l12-2 6 5M95 112l10 6 7-1" />
          </g>
          <circle cx="88" cy="95" r="1" fill="#21153f" />
          <circle cx="92" cy="95" r="1" fill="#21153f" />
        </g>
        <g fill="none" stroke="rgba(167,139,250,.5)" strokeWidth="1" style={{ animation: "bunny-web-pulse 3s ease-in-out infinite" }}>
          <path d="M29 145c15-17 31-23 61-23s46 6 61 23M42 163c12-12 25-16 48-16s36 4 48 16M60 179c8-6 17-8 30-8s22 2 30 8" />
        </g>
      </svg>
      <p className="relative max-w-sm text-sm font-bold leading-relaxed text-white">
        Hang tight! 🕷️ Flicks Community is scanning and weaving your video for high-definition cinematic quality and safety standards...
      </p>
      <div className="relative mt-5 w-full max-w-56">
        {progressPercent !== null ? (
          <p className="mb-2 text-3xl font-black tabular-nums text-violet-200">
            {Math.round(progressPercent)}%
          </p>
        ) : null}
        <p className="mb-2 text-xs font-semibold text-white/70">{progressText}</p>
        <div className="h-1 overflow-hidden rounded-full bg-white/15">
          {progressPercent !== null ? (
            <div
              className="h-full bg-violet-300 transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-violet-300" />
          )}
        </div>
        {progressPercent !== null && (
          <div className="mt-2 text-[11px] text-white/50">
            {isUploading ? "Upload progress" : "Encoding progress"}
          </div>
        )}
      </div>
    </div>
  );
}
