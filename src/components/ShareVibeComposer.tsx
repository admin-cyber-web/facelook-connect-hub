import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";

const PROMPT = "Share your vibe today...";

interface ShareVibeComposerProps {
  userProfile?: {
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
  onOpen: () => void;
  onMediaSelect: (file: File) => void;
}

function useTypewriterPrompt() {
  const [text, setText] = useState("");
  const [stopped, setStopped] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    // Android WebView versions that predate addEventListener on MediaQueryList.
    mediaQuery.addListener?.(handleChange);

    return () => {
      mediaQuery.removeEventListener?.("change", handleChange);
      mediaQuery.removeListener?.(handleChange);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setText(PROMPT);
      return;
    }

    if (stopped) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let index = 0;
    let deleting = false;

    const tick = () => {
      if (cancelled) return;

      if (!deleting) {
        index += 1;
        setText(PROMPT.slice(0, index));

        if (index === PROMPT.length) {
          deleting = true;
          timer = setTimeout(tick, 1500);
        } else {
          timer = setTimeout(tick, 62);
        }
        return;
      }

      index -= 1;
      setText(PROMPT.slice(0, index));

      if (index === 0) {
        deleting = false;
        timer = setTimeout(tick, 420);
      } else {
        timer = setTimeout(tick, 34);
      }
    };

    timer = setTimeout(tick, 520);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [prefersReducedMotion, stopped]);

  const stop = useCallback(() => {
    setStopped(true);
    setText(PROMPT);
  }, []);

  return { text: text || PROMPT, stop, prefersReducedMotion };
}

export default function ShareVibeComposer({
  userProfile,
  onOpen,
  onMediaSelect,
}: ShareVibeComposerProps) {
  const { text, stop, prefersReducedMotion } = useTypewriterPrompt();
  const displayName = userProfile?.full_name?.trim() || "your";
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const openComposer = () => {
    stop();
    onOpen();
  };

  return (
    <section
      aria-label="Create a post"
      className="relative mx-3 mt-2 mb-3 overflow-hidden rounded-[26px] p-[1px] shadow-[0_14px_34px_rgba(5,10,35,0.22)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[26px] bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500 opacity-90"
      />
      <div className="relative flex items-center gap-3 rounded-[25px] bg-white px-3 py-3.5 sm:gap-4 sm:px-4">
        <div className="relative shrink-0 rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-pink-500 p-[2px] shadow-[0_0_14px_rgba(34,211,238,0.35)]">
          <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-slate-100 sm:h-12 sm:w-12">
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt={`${displayName} avatar`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-cyan-100 text-base font-black text-indigo-700">
                {displayName[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>
          <span
            aria-label="Online"
            className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm"
          />
        </div>

        <button
          type="button"
          onPointerDown={stop}
          onClick={openComposer}
          onKeyDown={(event) => {
            stop();
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          className="min-w-0 flex-1 rounded-2xl px-1.5 py-1 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-400"
          aria-label="Open post composer"
        >
          <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
            Share your vibe
          </span>
          <span className="mt-1 block truncate text-[14px] font-semibold text-slate-700 sm:text-[15px]">
            {text}
            {!prefersReducedMotion && (
              <span aria-hidden="true" className="ml-0.5 inline-block h-4 border-r-2 border-indigo-400 align-[-2px]" />
            )}
          </span>
        </button>

        <button
          type="button"
          onPointerDown={stop}
          onClick={() => {
            stop();
            mediaInputRef.current?.click();
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2.5 text-[10px] font-black text-white shadow-[0_6px_14px_rgba(79,70,229,0.28)] transition-transform active:scale-95 sm:gap-2 sm:px-3.5 sm:text-[11px]"
          aria-label="Add media or photo"
        >
          <Camera size={15} strokeWidth={2.5} />
          <span>Media / Photo</span>
        </button>
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onMediaSelect(file);
            event.target.value = "";
          }}
        />
      </div>
    </section>
  );
}