import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] flex flex-col items-center justify-between px-6 py-14 relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-blue-600/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top spacer */}
      <div />

      {/* ── CENTER CONTENT ── */}
      <div className="flex flex-col items-center gap-8 w-full max-w-xs z-10">

        {/* 3D Flipping F Logo */}
        <div style={{ perspective: "700px" }}>
          <motion.div
            animate={{ rotateY: [0, 180, 360] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 2.5,
            }}
            style={{ transformStyle: "preserve-3d", position: "relative", width: 96, height: 96 }}
          >
            {/* Front face */}
            <div
              style={{ backfaceVisibility: "hidden" }}
              className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-400 via-blue-600 to-purple-700 flex items-center justify-center shadow-2xl shadow-blue-500/50 border border-white/10"
            >
              <span className="text-6xl font-black text-white select-none drop-shadow-lg">F</span>
            </div>
            {/* Back face */}
            <div
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-600 flex items-center justify-center shadow-2xl shadow-purple-500/50 border border-white/10"
            >
              <span className="text-6xl font-black text-white select-none drop-shadow-lg">F</span>
            </div>
          </motion.div>
        </div>

        {/* Brand */}
        <div className="text-center space-y-2">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-black tracking-tight bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent"
          >
            Flicks
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-white/50 font-medium leading-relaxed max-w-[240px] mx-auto"
          >
            Connect the Unconnected,{" "}
            <span className="text-white/70 font-semibold">Discover the Real You.</span>
          </motion.p>
        </div>

        {/* Google Button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full space-y-3"
        >
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full h-14 bg-white hover:bg-slate-50 active:scale-[0.97] transition-all rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-blue-900/30 font-black text-sm text-slate-800 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin text-slate-500" />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.3 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-4z"/>
                  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.1 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8L6 33.1C9.3 39.6 16.1 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.5 36.2 44 30.5 44 24c0-1.3-.1-2.7-.4-4z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {error && (
            <p className="text-red-400 text-xs text-center font-bold px-2">{error}</p>
          )}
        </motion.div>

        {/* Privacy link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="text-[11px] text-white/30 text-center leading-relaxed font-medium"
        >
          By continuing, you agree to Flicks's{" "}
          <a href="/privacy" className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors">
            Privacy Policy
          </a>
        </motion.p>
      </div>

      {/* ── FOOTER CREDITS ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col items-center gap-3 z-10"
      >
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-2.5">
          <span className="text-[11px] font-black text-white/70 tracking-widest uppercase">
            Powered by VKT
          </span>
          <span className="w-px h-4 bg-white/20" />
          <span className="text-[11px] font-black text-white/70 tracking-widest uppercase">
            Secure by Supabase
          </span>
        </div>
        <span className="text-[10px] text-white/25 font-medium">
          © 2025 Flicks · All rights reserved
        </span>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
