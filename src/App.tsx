import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ADMIN_EMAILS, isAdminEmail } from "./lib/adminConfig";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { Plus } from "lucide-react";
import AdminPostPanel from "./components/AdminPostPanel";
import CurvedEdgeOverlay from "./components/CurvedEdgeOverlay";
import { ProfileViewerProvider } from "./context/ProfileViewerContext";
import { DataCacheProvider } from "./context/DataCacheContext";
import { OnlineUsersProvider } from "./context/OnlineUsersContext";
import { HelmetProvider, Helmet } from "react-helmet-async";

const Index        = lazy(() => import("./pages/Index"));
const Privacy      = lazy(() => import("./pages/Privacy"));
const Terms        = lazy(() => import("./pages/Terms"));
const DataInfo     = lazy(() => import("./pages/DataInfo"));
const NotFound     = lazy(() => import("./pages/NotFound"));
const LoginScreen  = lazy(() => import("./components/LoginScreen"));
const PostDetail   = lazy(() => import("./pages/PostDetail"));
const SurveyDetail = lazy(() => import("./pages/SurveyDetail"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime:    1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen bg-[#020617] flex items-center justify-center">
    <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

void ADMIN_EMAILS;

const App = () => {
  const [session, setSession]       = useState<Session | null | undefined>(undefined);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  useEffect(() => {
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
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <PageLoader />;

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
