import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

// ── Lazy-loaded pages ────────────────────────────────────────────────────────
// Each import() call becomes its own split chunk; the browser only downloads
// a chunk when that page is first needed.
const Index       = lazy(() => import("./pages/Index"));
const Privacy     = lazy(() => import("./pages/Privacy"));
const NotFound    = lazy(() => import("./pages/NotFound"));
const LoginScreen = lazy(() => import("./components/LoginScreen"));

const queryClient = new QueryClient();

// ── Shared loading spinner ───────────────────────────────────────────────────
// Shown both while auth is resolving AND while a lazy chunk is downloading.
const PageLoader = () => (
  <div className="min-h-screen bg-[#020617] flex items-center justify-center">
    <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── App ──────────────────────────────────────────────────────────────────────
const App = () => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Still resolving auth — show spinner before any lazy chunk fires
  if (session === undefined) return <PageLoader />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* Suspense catches every lazy chunk download in the subtree */}
          <Suspense fallback={<PageLoader />}>
            {!session ? (
              <LoginScreen />
            ) : (
              <Routes>
                <Route path="/"        element={<Index session={session} />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="*"        element={<NotFound />} />
              </Routes>
            )}
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
