import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ADMIN_EMAILS, isAdminEmail } from "./lib/adminConfig";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { registerPushPlayer } from "@/lib/oneSignalPush";
import { Plus } from "lucide-react";
import AdminPostPanel from "./components/AdminPostPanel";
import CurvedEdgeOverlay from "./components/CurvedEdgeOverlay";
import { ProfileViewerProvider } from "./context/ProfileViewerContext";
import { DataCacheProvider } from "./context/DataCacheContext";
import { OnlineUsersProvider } from "./context/OnlineUsersContext";
import { HelmetProvider, Helmet } from "react-helmet-async";

const Index         = lazy(() => import("./pages/Index"));
const Privacy       = lazy(() => import("./pages/Privacy"));
const Terms         = lazy(() => import("./pages/Terms"));
const DataInfo      = lazy(() => import("./pages/DataInfo"));
const NotFound      = lazy(() => import("./pages/NotFound"));
const LoginScreen   = lazy(() => import("./components/LoginScreen"));
const PostDetail    = lazy(() => import("./pages/PostDetail"));
const SurveyDetail  = lazy(() => import("./pages/SurveyDetail"));
const InviteLanding = lazy(() => import("./pages/InviteLanding"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime:    1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
    },
  },
});

const SPLASH_MIN_DURATION_MS = 2600;
const SPLASH_LETTERS = ["F", "L", "I", "C", "K", "S"];

const PageLoader = () => (
  <div
    role="status"
    aria-label="Loading Flicks India"
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      width: "100vw",
      height: "100dvh",
      minHeight: "100vh",
      overflow: "hidden",
      display: "grid",
      placeItems: "center",
      isolation: "isolate",
      background: [
        "radial-gradient(circle at 50% 42%, rgba(37, 238, 255, 0.12), transparent 27%)",
        "radial-gradient(circle at 16% 82%, rgba(111, 0, 42, 0.34), transparent 38%)",
        "linear-gradient(145deg, #050108 0%, #18030f 50%, #020508 100%)",
      ].join(", "),
      color: "#fff",
      fontFamily: '"Arial Black", "Avenir Next", Inter, sans-serif',
    }}
  >
    <style>{`
      @keyframes flicks-letter-arrival {
        0% {
          opacity: 0;
          transform: perspective(700px) translate3d(0, 42px, 0) rotateX(72deg) scale(0.28);
          filter: blur(18px) brightness(2.6);
        }
        58% {
          opacity: 1;
          transform: perspective(700px) translate3d(0, -5px, 0) rotateX(-5deg) scale(1.08);
          filter: blur(0) brightness(1.55);
        }
        100% {
          opacity: 1;
          transform: perspective(700px) translate3d(0, 0, 0) rotateX(0) scale(1);
          filter: blur(0) brightness(1);
        }
      }

      @keyframes flicks-word-pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
          filter: brightness(1) drop-shadow(0 0 16px rgba(78, 238, 255, 0.35));
        }
        11% {
          opacity: 0.72;
          transform: scale(0.996);
          filter: brightness(1.45) drop-shadow(0 0 30px rgba(255, 244, 63, 0.8));
        }
        18% {
          opacity: 1;
          transform: scale(1.018);
          filter: brightness(1.2) drop-shadow(0 0 42px rgba(43, 236, 255, 0.72));
        }
        28% {
          opacity: 0.84;
          filter: brightness(1.1) drop-shadow(0 0 18px rgba(255, 244, 63, 0.5));
        }
        38% {
          opacity: 1;
          transform: scale(1);
          filter: brightness(1) drop-shadow(0 0 16px rgba(78, 238, 255, 0.35));
        }
      }

      @keyframes flicks-scan-line {
        0% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
        16% { opacity: 0.9; }
        48%, 100% { transform: translateX(330%) skewX(-18deg); opacity: 0; }
      }

      @keyframes flicks-orbit {
        0%, 100% { transform: rotate(0deg) scale(1); opacity: 0.45; }
        50% { transform: rotate(180deg) scale(1.08); opacity: 0.85; }
      }

      .flicks-splash-letter {
        display: inline-block;
        opacity: 0;
        color: transparent;
        background: linear-gradient(140deg, #fff96a 0%, #dfff45 35%, #52edff 78%, #a8fbff 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 0 22px rgba(227, 255, 66, 0.22);
        animation: flicks-letter-arrival 1.25s cubic-bezier(.16,.84,.32,1) var(--flicks-letter-delay) forwards;
        will-change: transform, opacity, filter;
      }

      .flicks-splash-word {
        animation: flicks-word-pulse 2.4s ease-in-out 1.35s infinite;
        will-change: transform, opacity, filter;
      }

      .flicks-splash-orbit {
        animation: flicks-orbit 7s ease-in-out infinite;
        transform-origin: center;
      }

      @media (prefers-reduced-motion: reduce) {
        .flicks-splash-letter,
        .flicks-splash-word,
        .flicks-splash-orbit {
          animation: none !important;
        }
        .flicks-splash-letter { opacity: 1; }
      }
    `}</style>

    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: "-24%",
        zIndex: -1,
        pointerEvents: "none",
        background: "conic-gradient(from 210deg at 50% 50%, transparent 0deg, rgba(39, 239, 255, 0.08) 34deg, transparent 78deg, rgba(255, 230, 49, 0.06) 160deg, transparent 215deg)",
      }}
      className="flicks-splash-orbit"
    />

    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "50%",
        left: 0,
        width: "100%",
        height: 2,
        pointerEvents: "none",
        background: "linear-gradient(90deg, transparent, rgba(112, 245, 255, 0.78), rgba(255, 245, 76, 0.7), transparent)",
        boxShadow: "0 0 28px rgba(70, 235, 255, 0.8)",
        animation: "flicks-scan-line 2.8s cubic-bezier(.2,.7,.3,1) 0.45s both",
      }}
    />

    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        transform: "translateY(-3vh)",
      }}
    >
      <div
        className="flicks-splash-word"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "clamp(3.4rem, 16vw, 10rem)",
          lineHeight: 0.86,
          letterSpacing: "0.045em",
          fontWeight: 950,
          whiteSpace: "nowrap",
        }}
      >
        {SPLASH_LETTERS.map((letter, index) => (
          <span
            key={letter}
            className="flicks-splash-letter"
            style={{ "--flicks-letter-delay": `${index * 0.13}s` } as React.CSSProperties}
          >
            {letter}
          </span>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "rgba(217, 252, 255, 0.68)",
          fontSize: "clamp(0.58rem, 1.8vw, 0.8rem)",
          fontWeight: 700,
          letterSpacing: "0.62em",
          paddingLeft: "0.62em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 26, height: 1, background: "linear-gradient(90deg, transparent, #dfff45)" }} />
        India
        <span style={{ width: 26, height: 1, background: "linear-gradient(90deg, #52edff, transparent)" }} />
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        bottom: "max(28px, env(safe-area-inset-bottom))",
        color: "rgba(255,255,255,0.32)",
        fontSize: 10,
        letterSpacing: "0.34em",
        paddingLeft: "0.34em",
        textTransform: "uppercase",
      }}
    >
      Real connections. Real stories.
    </div>
  </div>
);

void ADMIN_EMAILS;

const App = () => {
  const [session, setSession]       = useState<Session | null | undefined>(undefined);
  const [splashReady, setSplashReady] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setSplashReady(true), SPLASH_MIN_DURATION_MS);

    supabase.auth.getSession().then(({ data, error }) => {
      console.log(
        "[Auth] getSession →",
        data.session ? `✅ user=${data.session.user.email}` : "❌ no session",
        error ? `| error: ${error.message}` : "",
      );
      setSession(data.session);
    }).catch((err) => {
      console.warn("[Auth] getSession failed", err);
      setSession(null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      console.log(`[Auth] onAuthStateChange → event=${event}  user=${s?.user?.email ?? "none"}`);
      // INITIAL_SESSION is handled by getSession() above.
      // TOKEN_REFRESHED fires silently every ~hour — skipping it prevents a full
      // app-tree re-render / re-mount that causes overheating on mobile.
      if (
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED" ||
        event === "MFA_CHALLENGE_VERIFIED"
      ) return;
      setSession(s);
      // Register OneSignal push subscription whenever a user signs in
      if (event === "SIGNED_IN" && s?.user?.id) {
        registerPushPlayer(s.user.id);
        // ── Referral tracking — log invite chain when user joined via /invite?ref= ──
        const referrerId = localStorage.getItem("flicks_referrer");
        if (referrerId && referrerId !== s.user.id) {
          supabase.from("magnet_chains").upsert({
            post_id:    `referral_${referrerId}`,
            post_type:  "referral",
            user_id:    s.user.id,
            invited_by: referrerId,
            depth:      1,
          }, { onConflict: "user_id,post_id,post_type", ignoreDuplicates: true })
            .then(() => localStorage.removeItem("flicks_referrer"))
            .catch(() => {});
        }
      }
    });

    return () => {
      window.clearTimeout(splashTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  if (session === undefined || !splashReady) return <PageLoader />;

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <Helmet>
          <title>Flicks India | Real Connections, Real Stories</title>
          <meta name="description"        content="India's premium social space built for authentic connections. Share cinematic posts, catch the latest trends, and vibe with a real community 24/7." />
          <meta name="theme-color"        content="#1a0005" />
          <meta property="og:type"        content="website" />
          <meta property="og:site_name"   content="Flicks India" />
          <meta property="og:title"       content="Flicks India | Real Connections, Real Stories" />
          <meta property="og:description" content="India's premium social space built for authentic connections. Share cinematic posts, catch the latest trends, and vibe with a real community 24/7." />
          <meta property="og:image"       content="/logo.png" />
          <meta property="og:image:alt"   content="Flicks India" />
          <meta property="og:url"         content="https://flicksindia.online/" />
          <meta property="og:locale"      content="en_IN" />
          <meta name="twitter:card"        content="summary_large_image" />
          <meta name="twitter:site"        content="@FlicksIndia" />
          <meta name="twitter:title"       content="Flicks India | Real Connections, Real Stories" />
          <meta name="twitter:description" content="India's premium social space built for authentic connections. Share cinematic posts, catch the latest trends, and vibe with a real community 24/7." />
          <meta name="twitter:image"       content="/logo.png" />
        </Helmet>

        <TooltipProvider>
          <Toaster />
          <Sonner />

          <CurvedEdgeOverlay />

          {isAdminEmail(session?.user?.email || "") && (
            <button
              onClick={() => setIsAdminOpen(true)}
              className="fixed bottom-6 right-6 z-[100] bg-blue-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:scale-110 active:scale-95 transition-all border-2 border-white/20"
            >
              <Plus size={28} strokeWidth={3} />
            </button>
          )}

          {isAdminOpen && (
            <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-sm relative">
                <AdminPostPanel onClose={() => setIsAdminOpen(false)} />
              </div>
            </div>
          )}

          <ProfileViewerProvider
            currentUserId={session?.user?.id ?? ""}
            currentUserEmail={session?.user?.email ?? ""}
          >
            <OnlineUsersProvider userId={session?.user?.id}>
              <DataCacheProvider>
                <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                  <Suspense fallback={<PageLoader />}>
                    {!session ? (
                      <Routes>
                        <Route path="/privacy"     element={<Privacy />} />
                        <Route path="/terms"       element={<Terms />} />
                        <Route path="/data-info"   element={<DataInfo />} />
                        <Route path="/survey/:id"  element={<SurveyDetail />} />
                        <Route path="/invite"      element={<InviteLanding />} />
                        <Route path="*"            element={<LoginScreen />} />
                      </Routes>
                    ) : (
                      <Routes>
                        <Route path="/"            element={<Index session={session} />} />
                        <Route path="/privacy"     element={<Privacy />} />
                        <Route path="/terms"       element={<Terms />} />
                        <Route path="/data-info"   element={<DataInfo />} />
                        <Route path="/post/:id"    element={<PostDetail />} />
                        <Route path="/survey/:id"  element={<SurveyDetail />} />
                        <Route path="/invite"      element={<InviteLanding />} />
                        <Route
                          path="/admin"
                          element={
                            isAdminEmail(session.user.email || "")
                              ? <Index session={session} initialAdminOpen />
                              : <Navigate to="/" replace />
                          }
                        />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    )}
                  </Suspense>
                </BrowserRouter>
              </DataCacheProvider>
            </OnlineUsersProvider>
          </ProfileViewerProvider>
        </TooltipProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
};

export default App;
