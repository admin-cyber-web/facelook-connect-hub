import { useEffect, useRef } from "react";

/*
  Safe Ad Container — Native Banner / Social Bar
  — Loads only the provided Adsterra container-based ad script.
  This script renders ads INSIDE the div below. It does NOT open
  new tabs, popunders, or perform any redirects.
*/

const BANNER_SCRIPT =
  "https://pl30107898.effectivecpmnetwork.com/7f/47/c3/7f47c3a00924481b8425d03e8d724fa2.js";

interface AdsterraAdProps {
  className?: string;
}

export default function AdsterraAd({ className = "" }: AdsterraAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    injected.current = true;

    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = BANNER_SCRIPT;
    script.async = true;
    container.appendChild(script);

    return () => {
      try {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      } catch {
        // ignore
      }
      injected.current = false;
    };
  }, []);

  return (
    <div
      className={`w-full my-3 rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg overflow-hidden ${className}`}
    >
      <div className="px-3 py-2 flex items-center gap-2 border-b border-white/5">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
          Sponsored
        </span>
      </div>
      <div
        ref={containerRef}
        className="min-h-[90px] flex items-center justify-center"
      />
    </div>
  );
}
