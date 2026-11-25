const BUNNY_OFFLINE_GIF_URL = "https://flicksindiacdn.b-cdn.net/Stickers/dog%20searching.gif";
const OFFLINE_CACHE_NAME = "flicks-offline-media-v1";

type OfflineConnectionScreenProps = {
  reconnecting: boolean;
  retrySeconds: number;
  onRetry: () => void;
};

function SearchingDogFallback() {
  return (
    <svg
      role="img"
      aria-label="Searching for connection"
      className="offline-searching-dog mx-auto h-48 w-auto max-w-full"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="dogGradient" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#FFA500" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FF8C00" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="60" cy="110" rx="35" ry="8" fill="rgba(0,0,0,0.15)" />

      {/* Back legs */}
      <g className="dog-back-legs">
        <path
          d="M50 85 Q45 95 40 100"
          stroke="url(#dogGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M58 85 Q53 95 48 100"
          stroke="url(#dogGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Body */}
      <ellipse cx="60" cy="70" rx="30" ry="22" fill="url(#dogGradient)" />

      {/* Front legs */}
      <g className="dog-front-legs">
        <path
          d="M75 85 Q80 95 85 100"
          stroke="url(#dogGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M83 85 Q88 95 93 100"
          stroke="url(#dogGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Tail */}
      <path
        className="dog-tail"
        d="M88 65 Q105 55 110 45"
        stroke="url(#dogGradient)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Neck */}
      <path
        d="M78 58 Q85 45 85 35"
        stroke="url(#dogGradient)"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />

      {/* Head */}
      <g className="dog-head">
        <ellipse cx="85" cy="28" rx="16" ry="14" fill="url(#dogGradient)" />

        {/* Snout */}
        <ellipse cx="96" cy="30" rx="10" ry="8" fill="url(#dogGradient)" />

        {/* Nose */}
        <ellipse cx="103" cy="30" rx="3.5" ry="3" fill="#2D1B00" />

        {/* Eye */}
        <g className="dog-eye">
          <circle cx="82" cy="24" r="4" fill="#1A0F00" />
          <circle cx="83" cy="23" r="1.5" fill="#FFD700" />
        </g>

        {/* Ear */}
        <path
          className="dog-ear"
          d="M75 18 Q65 0 70 10 Q72 16 75 18"
          fill="url(#dogGradient)"
        />

        {/* Inner ear */}
        <path
          className="dog-ear-inner"
          d="M74 20 Q68 10 72 14"
          stroke="#FF8C00"
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
      </g>

      {/* Sniff lines - animated */}
      <g className="dog-sniff-lines" aria-hidden="true">
        <path
          d="M100 22 Q110 18 115 15"
          stroke="#FFD700"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M102 26 Q114 22 120 18"
          stroke="#FFD700"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M98 18 Q108 14 112 10"
          stroke="#FFD700"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      </g>

      <style>{`
        .offline-searching-dog {
          animation: dog-float 3s ease-in-out infinite;
        }

        .dog-head {
          transform-origin: 85px 40px;
          animation: dog-sniff 2.5s ease-in-out infinite;
        }

        .dog-ear {
          transform-origin: 75px 20px;
          animation: dog-ear-flick 3s ease-in-out infinite;
        }

        .dog-ear-inner {
          transform-origin: 74px 16px;
          animation: dog-ear-flick 3s ease-in-out infinite 0.1s;
        }

        .dog-tail {
          transform-origin: 88px 65px;
          animation: dog-tail-wag 1.2s ease-in-out infinite;
        }

        .dog-front-legs {
          transform-origin: 80px 85px;
          animation: dog-legs-step 2s ease-in-out infinite;
        }

        .dog-back-legs {
          transform-origin: 52px 85px;
          animation: dog-legs-step 2s ease-in-out infinite 0.5s;
        }

        .dog-sniff-lines {
          transform-origin: 103px 30px;
        }

        .dog-sniff-lines path:nth-child(1) {
          animation: dog-sniff-line 1.5s ease-in-out infinite;
        }

        .dog-sniff-lines path:nth-child(2) {
          animation: dog-sniff-line 1.5s ease-in-out infinite 0.3s;
        }

        .dog-sniff-lines path:nth-child(3) {
          animation: dog-sniff-line 1.5s ease-in-out infinite 0.6s;
        }

        @keyframes dog-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes dog-sniff {
          0%, 100% { transform: rotate(-3deg); }
          25% { transform: rotate(3deg); }
          50% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
        }

        @keyframes dog-ear-flick {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-15deg); }
          40% { transform: rotate(5deg); }
          60% { transform: rotate(-8deg); }
        }

        @keyframes dog-tail-wag {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(20deg); }
        }

        @keyframes dog-legs-step {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3px); }
        }

        @keyframes dog-sniff-line {
          0% { opacity: 0; transform: translateX(0) scale(0.8); }
          50% { opacity: 0.8; transform: translateX(8px) scale(1.2); }
          100% { opacity: 0; transform: translateX(15px) scale(1.5); }
        }

        @media (prefers-reduced-motion: reduce) {
          .offline-searching-dog,
          .dog-head,
          .dog-ear,
          .dog-ear-inner,
          .dog-tail,
          .dog-front-legs,
          .dog-back-legs,
          .dog-sniff-lines path {
            animation: none !important;
          }
          .offline-searching-dog { transform: none; }
          .dog-head { transform: none; }
          .dog-ear { transform: none; }
          .dog-ear-inner { transform: none; }
          .dog-tail { transform: none; }
          .dog-front-legs { transform: none; }
          .dog-back-legs { transform: none; }
          .dog-sniff-lines path { opacity: 0.5; transform: none; }
        }
      `}</style>
    </svg>
  );
}

export default function OfflineConnectionScreen({
  reconnecting: _reconnecting,
  retrySeconds: _retrySeconds,
  onRetry: _onRetry,
}: OfflineConnectionScreenProps) {
  const [gifSrc, setGifSrc] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadFromCache = async () => {
      try {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const response = await cache.match(BUNNY_OFFLINE_GIF_URL);

        if (response) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            objectUrlRef.current = objectUrl;
            setGifSrc(objectUrl);
          }
        } else if (!cancelled) {
          setUseFallback(true);
        }
      } catch {
        if (!cancelled) {
          setUseFallback(true);
        }
      }
    };

    loadFromCache();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  return (
    <main
      role="alert"
      aria-live="assertive"
      className="offline-screen fixed inset-0 z-[100000] flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto px-5 text-center"
    >
      <div className="relative z-10 w-full max-w-md px-4 py-8">
        {gifSrc ? (
          <img
            src={gifSrc}
            alt="Searching for connection"
            className="mx-auto h-48 w-auto max-w-full"
          />
        ) : (
          <SearchingDogFallback />
        )}
        <p className="mt-6 text-base font-medium text-white/90 leading-relaxed">
          Your network may be slow or unavailable on your phone; connecting to better connectivity.
        </p>
      </div>
    </main>
  );
}