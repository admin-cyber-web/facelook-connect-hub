import { BookOpen, RefreshCw, Users, Video } from "lucide-react";

type OfflineConnectionScreenProps = {
  reconnecting: boolean;
  retrySeconds: number;
  onRetry: () => void;
};

function FloatingAstronaut() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 230"
      className="offline-astronaut-float h-full w-full overflow-visible"
      fill="none"
    >
      <defs>
        <filter id="astronaut-lemon-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0.95  0 1 0 0 0.91  0 0 1 0 0.13  0 0 0 0.8 0"
            result="lemon"
          />
          <feMerge>
            <feMergeNode in="lemon" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="astronaut-suit" x1="93" y1="91" x2="171" y2="191" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFDEB" />
          <stop offset="1" stopColor="#C7D8ED" />
        </linearGradient>
        <linearGradient id="astronaut-glass" x1="111" y1="51" x2="164" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8AE7FF" />
          <stop offset=".55" stopColor="#365884" />
          <stop offset="1" stopColor="#111A39" />
        </linearGradient>
      </defs>

      <circle cx="130" cy="119" r="77" fill="#F5ED3B" fillOpacity=".08" />
      <circle cx="130" cy="119" r="61" stroke="#F5ED3B" strokeOpacity=".22" strokeDasharray="3 8" />
      <g filter="url(#astronaut-lemon-glow)" transform="rotate(-9 130 115)">
        <path d="M94 129 72 148c-5 5-5 13 0 18 5 5 13 5 18 0l24-20" fill="url(#astronaut-suit)" stroke="#F5ED3B" strokeWidth="3" />
        <path d="m161 128 24 14c7 4 9 12 5 18-4 7-12 9-19 5l-25-15" fill="url(#astronaut-suit)" stroke="#F5ED3B" strokeWidth="3" />
        <path d="m103 164-7 27c-1 7 4 13 11 14 7 1 13-3 14-10l6-25m24-7 8 27c2 7 9 10 15 8 7-2 10-9 8-16l-10-28" fill="url(#astronaut-suit)" stroke="#F5ED3B" strokeWidth="3" strokeLinejoin="round" />
        <path d="M100 106c0-12 9-21 21-21h24c12 0 21 9 21 21v53c0 9-7 16-16 16h-34c-9 0-16-7-16-16v-53Z" fill="url(#astronaut-suit)" stroke="#F5ED3B" strokeWidth="3" />
        <rect x="116" y="119" width="34" height="29" rx="7" fill="#26364F" stroke="#F5ED3B" strokeWidth="2" />
        <path d="M122 127h8v5h-8zm13 0h9v5h-9z" fill="#F5ED3B" />
        <path d="M126 138h15v4h-15z" fill="#79E7FF" />
        <circle cx="131" cy="69" r="31" fill="url(#astronaut-suit)" stroke="#F5ED3B" strokeWidth="4" />
        <path d="M108 68c0-12 10-22 22-22h5c11 0 20 9 20 20v3c0 12-9 21-20 21h-7c-11 0-20-9-20-20v-2Z" fill="url(#astronaut-glass)" stroke="#D5FBFF" strokeWidth="2" />
        <path d="m116 60 14-9m-8 24 8-5" stroke="#E9FFFF" strokeOpacity=".76" strokeWidth="3" strokeLinecap="round" />
        <path d="M72 150c-7-2-13 2-15 8-2 6 2 12 8 14 6 2 12-1 15-7m112-5c7-3 14 0 16 6 3 6 0 13-6 16-6 3-13 0-16-6" fill="#E7F2FF" stroke="#F5ED3B" strokeWidth="3" />
        <path d="M99 193c-6 2-9 8-7 14 2 5 7 8 13 7l15-3 3-15m36-5 5 16 13 5c6 2 12-1 14-7 2-5-1-11-6-13" fill="#B6CBE2" stroke="#F5ED3B" strokeWidth="3" />
      </g>
      <path d="m53 78 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Zm155 23 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" fill="#F5ED3B" />
      <circle cx="72" cy="49" r="2.5" fill="#FFF7A3" />
      <circle cx="198" cy="72" r="2" fill="#FFF7A3" />
      <circle cx="187" cy="187" r="2.5" fill="#F5ED3B" />
    </svg>
  );
}

const featureCards = [
  {
    title: "Flicks Video",
    description: "Your videos will be ready when you reconnect.",
    Icon: Video,
  },
  {
    title: "Flicks News",
    description: "Read Flicks News and Articles.",
    Icon: BookOpen,
  },
  {
    title: "Flicks Social Area",
    description: "Your people and conversations are waiting.",
    Icon: Users,
  },
];

export default function OfflineConnectionScreen({
  reconnecting,
  retrySeconds,
  onRetry,
}: OfflineConnectionScreenProps) {
  return (
    <main
      role="alert"
      aria-live="assertive"
      className="offline-screen fixed inset-0 z-[100000] flex min-h-[100dvh] flex-col items-center overflow-y-auto px-5 text-center"
    >
      <div className="offline-ambient" aria-hidden="true" />
      <div className="relative z-10 flex min-h-[100dvh] w-full max-w-md flex-col items-center">
        <header className="offline-header pt-[max(28px,env(safe-area-inset-top))]">
          <p className="offline-eyebrow">FLICKS INDIA</p>
          <h1 className="offline-title">Aww... Connection Lost!</h1>
          <p className="offline-description">
            Looks like the signal drifted away. We&apos;re trying to bring it back.
          </p>
        </header>

        <div className="offline-astronaut my-1 h-[clamp(145px,24vh,205px)] w-[clamp(190px,62vw,245px)]" aria-hidden="true">
          <FloatingAstronaut />
        </div>

        <section aria-label="Flicks services" className="offline-features grid w-full gap-2.5">
          {featureCards.map(({ title, description, Icon }) => (
            <article key={title} className="offline-feature-card flex min-h-[68px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left">
              <span className="offline-feature-icon grid size-10 shrink-0 place-items-center rounded-xl">
                <Icon size={19} strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="offline-feature-title block">{title}</span>
                <span className="offline-feature-description block">{description}</span>
              </span>
            </article>
          ))}
        </section>

        <footer className="mt-auto w-full pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
          <button
            type="button"
            onClick={onRetry}
            disabled={reconnecting}
            className="offline-retry-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-black tracking-[0.14em] text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-90"
          >
            <RefreshCw size={17} className={reconnecting ? "animate-spin" : ""} />
            {reconnecting ? "RECONNECTING..." : "RETRY CONNECTION"}
          </button>
          <p className="offline-timer mt-3" aria-live="polite">
            {reconnecting ? "Checking your connection…" : `Automatic retry in ${retrySeconds}s`}
          </p>
        </footer>
      </div>
    </main>
  );
}
