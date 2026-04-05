import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { Plus, X } from "lucide-react"; // Icons for Admin Button
import AdminPostPanel from "./components/AdminPostPanel"; // Make sure to create this file
import CurvedEdgeOverlay from "./components/CurvedEdgeOverlay";

// ── Lazy-loaded pages ────────────────────────────────────────────────────────
const Index = lazy(() => import("./pages/Index"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginScreen = lazy(() => import("./components/LoginScreen"));

const queryClient = new QueryClient();

// ── Shared loading spinner ───────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen bg-[#020617] flex items-center justify-center">
    <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── CONFIGURATION ────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "tiwarijhumki@gmail.com"; // <── BHAI YAHAN APNA GMAIL DALO

// ── App ──────────────────────────────────────────────────────────────────────
const App = () => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Still resolving auth
  if (session === undefined) return <PageLoader />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        {/* ── CURVED GLASS EDGE EFFECT ── */}
        <CurvedEdgeOverlay />

        {/* ── SECRET ADMIN BUTTON ── */}
        {/* Ye sirf tab dikhega jab aapka email match karega */}
        {session?.user?.email === ADMIN_EMAIL && (
          <button
            onClick={() => setIsAdminOpen(true)}
            className="fixed bottom-6 right-6 z-[100] bg-blue-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:scale-110 active:scale-95 transition-all border-2 border-white/20"
          >
            <Plus size={28} strokeWidth={3} />
          </button>
        )}

        {/* ── ADMIN PANEL MODAL ── */}
        {isAdminOpen && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm relative">
              <AdminPostPanel onClose={() => setIsAdminOpen(false)} />
            </div>
          </div>
        )}


        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            {!session ? (
              <LoginScreen />
            ) : (
              <Routes>
                <Route path="/" element={<Index session={session} />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            )}
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
