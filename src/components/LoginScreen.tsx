import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Loader2, Anchor, Users, Star, Zap, Frame, Bot, Clapperboard, Magnet,
  Eye, EyeOff, Mail, Lock, UserPlus, LogIn, ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabaseClient";

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Anchor,       label: "Hooks",      sub: "Viral content chains",    color: "#FFF44F", glow: "rgba(255,244,79,0.3)"   },
  { icon: Users,        label: "Circle",     sub: "Private group spaces",    color: "#60a5fa", glow: "rgba(96,165,250,0.3)"   },
  { icon: Star,         label: "Fame",       sub: "Social fame feed",        color: "#fbbf24", glow: "rgba(251,191,36,0.3)"   },
  { icon: Zap,          label: "Fun",        sub: "Live video calls",        color: "#34d399", glow: "rgba(52,211,153,0.3)"   },
  { icon: Frame,        label: "Frame",      sub: "Story frames & filters",  color: "#f472b6", glow: "rgba(244,114,182,0.3)"  },
  { icon: Bot,          label: "Auto Chat",  sub: "AI-powered messenger",    color: "#a78bfa", glow: "rgba(167,139,250,0.3)"  },
  { icon: Clapperboard, label: "Studio",     sub: "Creator tools & reels",   color: "#fb7185", glow: "rgba(251,113,133,0.3)"  },
];

const CREATOR_CARDS = [
  { name: "Priya S.",    handle: "@priya_creates", followers: "128K", badge: "🔥 Trending",  avatar: "P",  avatarBg: "linear-gradient(135deg,#800020,#FFF44F)" },
  { name: "Raj Kumar",   handle: "@rajvlogs",      followers: "92K",  badge: "⭐ Rising",   avatar: "R",  avatarBg: "linear-gradient(135deg,#4f46e5,#a78bfa)" },
  { name: "Neha M.",     handle: "@nehafame",      followers: "215K", badge: "👑 Top Creator",avatar: "N", avatarBg: "linear-gradient(135deg,#059669,#34d399)" },
];

const FLOATING = [
  { emoji: "🔥", x: 7,  y: 10, dur: 5.2, delay: 0.0, size: 22 },
  { emoji: "⭐", x: 88, y: 7,  dur: 6.1, delay: 0.8, size: 18 },
  { emoji: "🎬", x: 4,  y: 58, dur: 7.0, delay: 1.2, size: 20 },
  { emoji: "💫", x: 92, y: 45, dur: 4.8, delay: 0.3, size: 16 },
  { emoji: "🎵", x: 78, y: 82, dur: 5.5, delay: 1.7, size: 18 },
  { emoji: "💎", x: 13, y: 80, dur: 6.3, delay: 0.6, size: 20 },
  { emoji: "🎭", x: 50, y: 4,  dur: 4.4, delay: 1.0, size: 17 },
  { emoji: "👑", x: 96, y: 22, dur: 5.9, delay: 2.1, size: 19 },
];

// ── COMPONENT ────────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [tab,            setTab]            = useState<"signin" | "signup">("signin");
  const [loading,        setLoading]        = useState(false);
  const [emailLoading,   setEmailLoading]   = useState(false);
  const [error,          setError]          = useState("");
  const [success,        setSuccess]        = useState("");
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [confirmPass,    setConfirmPass]    = useState("");
  const [showPass,       setShowPass]       = useState(false);
  const [rememberMe,     setRememberMe]     = useState(false);
  const [agreedTerms,    setAgreedTerms]    = useState(false);
  const [agreedData,     setAgreedData]     = useState(false);
  const [showLegalError, setShowLegalError] = useState(false);
  const [shakeKey,       setShakeKey]       = useState(0);
  const [forgotMode,     setForgotMode]     = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const clearForm = () => {
    setError(""); setSuccess(""); setEmail(""); setPassword(""); setConfirmPass("");
    setForgotMode(false);
  };

  const switchTab = (t: "signin" | "signup") => { setTab(t); clearForm(); };

  // Google OAuth
  const handleGoogle = async () => {
    if (!agreedTerms || !agreedData) {
      setShowLegalError(true);
      setShakeKey((k) => k + 1);
      return;
    }
    setShowLegalError(false);
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: "https://flicksindia.online" },
      });
      if (error) setError("Google sign-in failed: " + error.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Email auth
  const handleEmailAuth = async () => {
    if (!agreedTerms || !agreedData) {
      setShowLegalError(true);
      setShakeKey((k) => k + 1);
      return;
    }
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (tab === "signup" && password !== confirmPass) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setShowLegalError(false);
    setEmailLoading(true);
    setError("");
    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) setError(error.message);
        else setSuccess("✅ Account created! Check your email to verify.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  // Forgot password
  const handleForgotPassword = async () => {
    if (!email.trim()) { setError("Enter your email above first."); emailRef.current?.focus(); return; }
    setEmailLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://flicksindia.online/reset-password",
      });
      if (error) setError(error.message);
      else setSuccess("📧 Reset link sent! Check your inbox.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  const toggle = (which: "terms" | "data") => {
    if (which === "terms") setAgreedTerms((v) => !v);
    else setAgreedData((v) => !v);
    if (showLegalError) setShowLegalError(false);
  };

  const inputStyle = (focused?: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "13px 14px 13px 42px",
    borderRadius: 13,
    background: "rgba(255,255,255,0.05)",
    border: `1.5px solid ${focused ? "rgba(255,244,79,0.5)" : "rgba(255,255,255,0.1)"}`,
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box" as const,
    boxShadow: focused ? "0 0 0 3px rgba(255,244,79,0.08)" : "none",
  });

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(145deg,#06000a 0%,#150008 35%,#0a0012 70%,#0d0005 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      fontFamily: "Inter, sans-serif",
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <Helmet>
        <title>Sign In | FlicksIndia</title>
        <meta name="robots" content="index, follow" />
      </Helmet>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        @keyframes legalShake {
          0%,100% { transform:translateX(0); }
          15%      { transform:translateX(-6px); }
          30%      { transform:translateX(6px); }
          45%      { transform:translateX(-4px); }
          60%      { transform:translateX(4px); }
          75%      { transform:translateX(-2px); }
        }
        .legal-shake { animation: legalShake 0.45s cubic-bezier(.36,.07,.19,.97) both; }

        @keyframes maroonPulse {
          0%,100% { opacity:.55; transform:scale(1); }
          50%      { opacity:.75; transform:scale(1.1); }
        }
        @keyframes lemonPulse {
          0%,100% { opacity:.25; transform:scale(1); }
          50%      { opacity:.45; transform:scale(1.15); }
        }
        @keyframes floatEmoji {
          0%,100% { transform:translateY(0) rotate(-3deg) scale(1); opacity:.45; }
          33%      { transform:translateY(-18px) rotate(4deg) scale(1.1); opacity:.7; }
          66%      { transform:translateY(-8px) rotate(-1deg) scale(1.04); opacity:.55; }
        }
        @keyframes shimmer {
          0%   { transform:translateX(-100%); }
          100% { transform:translateX(220%); }
        }
        @keyframes btnGlow {
          0%,100% { box-shadow:0 0 22px rgba(255,244,79,.3),0 6px 30px rgba(128,0,32,.45); }
          50%      { box-shadow:0 0 38px rgba(255,244,79,.5),0 8px 40px rgba(128,0,32,.65); }
        }
        .btn-glow { animation:btnGlow 2.6s ease-in-out infinite; }

        input:-webkit-autofill,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #1a0008 inset !important;
          -webkit-text-fill-color: #fff !important;
        }
        input::placeholder { color: rgba(255,255,255,0.28); }
        ::-webkit-scrollbar { width:0; }

        .feat-item:hover .feat-icon { transform:scale(1.15); }
        .feat-item:hover { transform:translateX(5px); }

        /* Desktop layout */
        .outer-grid {
          width:100%; max-width:1120px;
          display:flex; align-items:center; justify-content:center;
          gap:60px; padding:48px 40px;
        }
        .left-panel { flex:1; max-width:500px; }
        .right-panel { width:420px; flex-shrink:0; }

        /* Mobile */
        @media(max-width:900px){
          .outer-grid {
            flex-direction:column; gap:0;
            padding:0 0 40px; max-width:480px;
          }
          .left-panel { display:none!important; }
          .right-panel { width:100%; padding:0 18px; }
          .mobile-top { display:flex!important; }
        }
        @media(min-width:901px){
          .mobile-top { display:none!important; }
        }
      `}</style>

      {/* ── BG GLOWS ── */}
      <div style={{ position:"fixed", top:-130, right:-110, width:560, height:560,
        background:"radial-gradient(circle,rgba(128,0,32,.55) 0%,transparent 70%)",
        borderRadius:"50%", filter:"blur(70px)", pointerEvents:"none", zIndex:0,
        animation:"maroonPulse 8s ease-in-out infinite" }} />
      <div style={{ position:"fixed", bottom:-80, left:-80, width:440, height:440,
        background:"radial-gradient(circle,rgba(255,244,79,.18) 0%,transparent 70%)",
        borderRadius:"50%", filter:"blur(55px)", pointerEvents:"none", zIndex:0,
        animation:"lemonPulse 11s ease-in-out infinite 1.5s" }} />
      <div style={{ position:"fixed", top:"45%", left:"28%", width:320, height:320,
        background:"radial-gradient(circle,rgba(128,0,32,.18) 0%,transparent 70%)",
        borderRadius:"50%", filter:"blur(45px)", pointerEvents:"none", zIndex:0 }} />

      {/* ── FLOATING EMOJIS ── */}
      {FLOATING.map((e, i) => (
        <div key={i} style={{ position:"fixed", left:`${e.x}%`, top:`${e.y}%`, fontSize:e.size,
          zIndex:1, pointerEvents:"none", userSelect:"none",
          animation:`floatEmoji ${e.dur}s ease-in-out infinite ${e.delay}s`,
          filter:"drop-shadow(0 3px 8px rgba(128,0,32,.4))" }}>
          {e.emoji}
        </div>
      ))}

      {/* ── GRID ── */}
      <div className="outer-grid" style={{ position:"relative", zIndex:10 }}>

        {/* ════ LEFT PANEL (desktop only) ════ */}
        <div className="left-panel">
          <motion.div initial={{ opacity:0, x:-30 }} animate={{ opacity:1, x:0 }}
            transition={{ duration:0.65, ease:[0.22,1,0.36,1] }}>

            {/* Brand */}
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:12 }}>
              <div style={{
                width:58, height:58, borderRadius:18, flexShrink:0,
                background:"linear-gradient(140deg,#800020 0%,#4d0010 100%)",
                boxShadow:"0 0 36px rgba(128,0,32,.75),0 4px 16px rgba(0,0,0,.5)",
                display:"flex", alignItems:"center", justifyContent:"center",
                border:"1.5px solid rgba(255,244,79,.35)",
              }}>
                <Magnet size={28} color="#FFF44F" style={{ filter:"drop-shadow(0 2px 6px rgba(255,244,79,.5))" }} />
              </div>
              <div>
                <p style={{ margin:0, fontSize:30, fontWeight:900, color:"#fff", letterSpacing:-1.5, lineHeight:1.1 }}>
                  Flicks<span style={{ color:"#FFF44F", textShadow:"0 0 18px rgba(255,244,79,.55)" }}>India</span>
                </p>
                <p style={{ margin:0, fontSize:12, color:"rgba(255,244,79,.65)", fontWeight:700, letterSpacing:1 }}>
                  Post Karo, Earn Karo ✦
                </p>
              </div>
            </div>

            <p style={{ margin:"0 0 28px", fontSize:14, color:"rgba(255,255,255,.42)", lineHeight:1.75, maxWidth:380 }}>
              India's most powerful creator ecosystem — build your fame, grow your circle, and earn from what you love.
            </p>

            {/* Features */}
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {FEATURES.map((f, i) => (
                <motion.div key={f.label} className="feat-item"
                  initial={{ opacity:0, x:-18 }} animate={{ opacity:1, x:0 }}
                  transition={{ delay:0.08+i*0.065, duration:0.5, ease:[0.22,1,0.36,1] }}
                  style={{
                    display:"flex", alignItems:"center", gap:13, padding:"11px 15px",
                    borderRadius:15, background:"rgba(255,255,255,.03)",
                    border:"1px solid rgba(255,255,255,.06)", backdropFilter:"blur(10px)",
                    transition:"transform 0.2s", cursor:"default",
                  }}>
                  <div className="feat-icon" style={{
                    width:38, height:38, borderRadius:11, flexShrink:0,
                    background:`radial-gradient(circle,${f.glow} 0%,rgba(0,0,0,0) 100%)`,
                    border:`1.5px solid ${f.color}30`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow:`0 0 10px ${f.glow}`, transition:"transform 0.2s",
                  }}>
                    <f.icon size={17} color={f.color} />
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#fff" }}>{f.label}</p>
                    <p style={{ margin:0, fontSize:11, color:"rgba(255,255,255,.38)", fontWeight:500 }}>{f.sub}</p>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:"3px 7px", borderRadius:6,
                    background:`${f.color}18`, color:f.color, border:`1px solid ${f.color}28`, letterSpacing:.5 }}>
                    LIVE
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Creator cards */}
            <p style={{ margin:"28px 0 10px", fontSize:10, fontWeight:700, color:"rgba(255,255,255,.3)", letterSpacing:2, textTransform:"uppercase" }}>
              Top Creators
            </p>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {CREATOR_CARDS.map((c, i) => (
                <motion.div key={c.name}
                  initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }}
                  transition={{ delay:0.55+i*0.09, duration:0.45 }}
                  whileHover={{ y:-3, transition:{ duration:0.2 } }}
                  style={{
                    display:"flex", alignItems:"center", gap:9, padding:"9px 12px",
                    borderRadius:14, background:"rgba(255,255,255,.04)",
                    border:"1px solid rgba(255,255,255,.08)",
                    cursor:"default", backdropFilter:"blur(10px)",
                  }}>
                  <div style={{
                    width:34, height:34, borderRadius:10, background:c.avatarBg,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:900, color:"#fff", flexShrink:0,
                  }}>
                    {c.avatar}
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:12, fontWeight:800, color:"#fff" }}>{c.name}</p>
                    <p style={{ margin:0, fontSize:10, color:"rgba(255,255,255,.38)" }}>{c.followers} followers</p>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, color:"#FFF44F", marginLeft:2, whiteSpace:"nowrap" }}>
                    {c.badge}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ════ RIGHT / AUTH PANEL ════ */}
        <div className="right-panel">

          {/* Mobile brand header */}
          <div className="mobile-top" style={{ flexDirection:"column", alignItems:"center", paddingTop:44, paddingBottom:20, gap:0 }}>
            <motion.div initial={{ scale:0.4, rotate:-20, opacity:0 }} animate={{ scale:1, rotate:0, opacity:1 }}
              transition={{ duration:0.7, ease:[0.34,1.56,0.64,1] }}
              style={{ marginBottom:14 }}>
              <div style={{
                width:76, height:76, borderRadius:24,
                background:"linear-gradient(140deg,#800020 0%,#4d0010 60%,#2d0008 100%)",
                boxShadow:"0 0 42px rgba(128,0,32,.8),0 8px 28px rgba(0,0,0,.6)",
                display:"flex", alignItems:"center", justifyContent:"center",
                border:"1.5px solid rgba(255,244,79,.35)", position:"relative", overflow:"hidden",
              }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"42%",
                  background:"rgba(255,255,255,.12)", borderRadius:"24px 24px 0 0" }} />
                <Magnet size={32} color="#FFF44F" style={{ position:"relative", zIndex:1, filter:"drop-shadow(0 2px 8px rgba(255,244,79,.5))" }} />
              </div>
            </motion.div>
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.25, duration:0.45 }} style={{ textAlign:"center" }}>
              <h1 style={{ margin:0, fontSize:30, fontWeight:900, color:"#fff", letterSpacing:-1.2, lineHeight:1 }}>
                Flicks<span style={{ color:"#FFF44F", textShadow:"0 0 18px rgba(255,244,79,.55)" }}>India</span>
              </h1>
              <p style={{ margin:"5px 0 0", fontSize:11, fontWeight:700, color:"rgba(255,244,79,.65)", letterSpacing:"2px", textTransform:"uppercase" }}>
                Post Karo, Earn Karo ✦
              </p>
            </motion.div>

            {/* Mobile: horizontal feature scroll */}
            <div style={{ overflowX:"auto", display:"flex", gap:8, marginTop:18, paddingBottom:4,
              scrollbarWidth:"none", WebkitOverflowScrolling:"touch",
              width:"100%", paddingLeft:2, paddingRight:2 }}>
              {FEATURES.map((f, i) => (
                <motion.div key={f.label}
                  initial={{ opacity:0, scale:0.82 }} animate={{ opacity:1, scale:1 }}
                  transition={{ delay:0.05*i, duration:0.38 }}
                  style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                    padding:"9px 13px", borderRadius:14,
                    background:"rgba(255,255,255,.04)", border:`1px solid ${f.color}22`,
                    backdropFilter:"blur(12px)", minWidth:72,
                    boxShadow:`0 0 10px ${f.glow}` }}>
                  <div style={{ width:32, height:32, borderRadius:9,
                    background:`radial-gradient(circle,${f.glow} 0%,transparent 100%)`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    border:`1px solid ${f.color}28` }}>
                    <f.icon size={15} color={f.color} />
                  </div>
                  <span style={{ fontSize:10, fontWeight:800, color:f.color, whiteSpace:"nowrap" }}>{f.label}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── GLASS AUTH CARD ── */}
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:0.18, duration:0.55, ease:[0.22,1,0.36,1] }}
            style={{
              background:"rgba(255,255,255,.04)", backdropFilter:"blur(28px)",
              WebkitBackdropFilter:"blur(28px)",
              border:"1px solid rgba(255,255,255,.09)", borderRadius:28,
              padding:"26px 22px 22px",
              boxShadow:"0 12px 60px rgba(0,0,0,.55),0 0 0 1px rgba(128,0,32,.2) inset",
            }}>

            {/* Tab switcher */}
            <div style={{ display:"flex", background:"rgba(255,255,255,.05)", borderRadius:14, padding:4, marginBottom:22, gap:4 }}>
              {(["signin","signup"] as const).map((t) => (
                <button key={t} onClick={() => switchTab(t)} style={{
                  flex:1, padding:"9px 0", borderRadius:11,
                  background: tab === t
                    ? "linear-gradient(135deg,#800020 0%,#5a0016 100%)"
                    : "transparent",
                  color: tab === t ? "#FFF44F" : "rgba(255,255,255,.38)",
                  fontSize:13, fontWeight:800, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  transition:"all 0.22s",
                  boxShadow: tab === t ? "0 0 18px rgba(128,0,32,.4)" : "none",
                  border: tab === t ? "1px solid rgba(255,244,79,.25)" : "1px solid transparent",
                }}>
                  {t === "signin" ? <LogIn size={14} /> : <UserPlus size={14} />}
                  {t === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            {/* Forgot password mode notice */}
            <AnimatePresence>
              {forgotMode && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                  exit={{ opacity:0, height:0 }}
                  style={{ marginBottom:14, padding:"10px 13px", borderRadius:12,
                    background:"rgba(255,244,79,.08)", border:"1px solid rgba(255,244,79,.25)" }}>
                  <p style={{ margin:0, fontSize:12, color:"rgba(255,244,79,.9)", fontWeight:600, lineHeight:1.5 }}>
                    🔑 Enter your email below and tap <strong>Send Reset Link</strong>.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email field */}
            <div style={{ position:"relative", marginBottom:12 }}>
              <Mail size={15} style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,.3)", pointerEvents:"none" }} />
              <input
                ref={emailRef}
                type="email"
                placeholder="Email address"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => { e.currentTarget.style.borderColor="rgba(255,244,79,.5)"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(255,244,79,.08)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor="rgba(255,255,255,.1)"; e.currentTarget.style.boxShadow="none"; }}
                style={inputStyle()}
              />
            </div>

            {/* Password field */}
            <AnimatePresence>
              {!forgotMode && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                  exit={{ opacity:0, height:0 }} style={{ overflow:"hidden" }}>
                  <div style={{ position:"relative", marginBottom:tab === "signup" ? 12 : 8 }}>
                    <Lock size={15} style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,.3)", pointerEvents:"none" }} />
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="Password"
                      autoComplete={tab === "signin" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !emailLoading && handleEmailAuth()}
                      onFocus={(e) => { e.currentTarget.style.borderColor="rgba(255,244,79,.5)"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(255,244,79,.08)"; }}
                      onBlur={(e)  => { e.currentTarget.style.borderColor="rgba(255,255,255,.1)"; e.currentTarget.style.boxShadow="none"; }}
                      style={{ ...inputStyle(), paddingRight:42 }}
                    />
                    <button onClick={() => setShowPass((v) => !v)} style={{
                      position:"absolute", right:13, top:"50%", transform:"translateY(-50%)",
                      background:"none", border:"none", cursor:"pointer", padding:0,
                      color:"rgba(255,255,255,.35)", display:"flex", alignItems:"center",
                    }}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Confirm password (signup only) */}
                  <AnimatePresence>
                    {tab === "signup" && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                        exit={{ opacity:0, height:0 }} style={{ overflow:"hidden", marginBottom:12 }}>
                        <div style={{ position:"relative" }}>
                          <Lock size={15} style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,.3)", pointerEvents:"none" }} />
                          <input
                            type={showPass ? "text" : "password"}
                            placeholder="Confirm password"
                            autoComplete="new-password"
                            value={confirmPass}
                            onChange={(e) => setConfirmPass(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !emailLoading && handleEmailAuth()}
                            onFocus={(e) => { e.currentTarget.style.borderColor="rgba(255,244,79,.5)"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(255,244,79,.08)"; }}
                            onBlur={(e)  => { e.currentTarget.style.borderColor="rgba(255,255,255,.1)"; e.currentTarget.style.boxShadow="none"; }}
                            style={inputStyle()}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Remember Me + Forgot Password */}
                  {tab === "signin" && (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                      <label onClick={() => setRememberMe((v) => !v)} style={{
                        display:"flex", alignItems:"center", gap:8, cursor:"pointer",
                      }}>
                        <div style={{
                          width:18, height:18, borderRadius:5, flexShrink:0,
                          background: rememberMe ? "linear-gradient(135deg,#800020,#FFF44F)" : "rgba(255,255,255,.07)",
                          border:`1.5px solid ${rememberMe ? "#FFF44F" : "rgba(255,255,255,.15)"}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          transition:"all 0.2s",
                          boxShadow: rememberMe ? "0 0 8px rgba(255,244,79,.35)" : "none",
                        }}>
                          {rememberMe && <Check size={11} strokeWidth={3.5} color="#fff" />}
                        </div>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,.5)", fontWeight:500 }}>Remember me</span>
                      </label>
                      <button onClick={() => { setForgotMode(true); setError(""); setSuccess(""); }}
                        style={{ background:"none", border:"none", cursor:"pointer", padding:0,
                          fontSize:12, fontWeight:700, color:"rgba(255,244,79,.7)",
                          display:"flex", alignItems:"center", gap:4 }}>
                        Forgot password?
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Legal checkboxes */}
            <div key={shakeKey} className={showLegalError && (!agreedTerms || !agreedData) ? "legal-shake" : ""}
              style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
              {/* Terms */}
              <label onClick={() => toggle("terms")} style={{
                display:"flex", alignItems:"flex-start", gap:11, padding:"11px 13px",
                borderRadius:13, cursor:"pointer", transition:"all 0.2s",
                background: showLegalError && !agreedTerms ? "rgba(248,113,113,.07)" : "rgba(255,255,255,.03)",
                border:`1px solid ${showLegalError && !agreedTerms ? "rgba(248,113,113,.5)" : agreedTerms ? "rgba(255,244,79,.3)" : "rgba(255,255,255,.08)"}`,
              }}>
                <div style={{
                  width:20, height:20, borderRadius:6, flexShrink:0,
                  background: agreedTerms ? "linear-gradient(135deg,#800020,#FFF44F)" : showLegalError && !agreedTerms ? "rgba(248,113,113,.15)" : "rgba(255,255,255,.06)",
                  border:`2px solid ${agreedTerms ? "#FFF44F" : showLegalError && !agreedTerms ? "#f87171" : "rgba(255,255,255,.15)"}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.2s", boxShadow: agreedTerms ? "0 0 9px rgba(255,244,79,.38)" : "none",
                }}>
                  {agreedTerms && <Check size={12} strokeWidth={3.5} color="#fff" />}
                </div>
                <span style={{ fontSize:11.5, color:"rgba(255,255,255,.6)", lineHeight:1.5, fontWeight:500 }}>
                  I agree to the{" "}
                  <Link to="/terms" onClick={(e) => e.stopPropagation()} style={{ color:"#FFF44F", fontWeight:700 }}>Terms &amp; Conditions</Link>
                  {" "}and{" "}
                  <Link to="/privacy" onClick={(e) => e.stopPropagation()} style={{ color:"#FFF44F", fontWeight:700 }}>Privacy Policy</Link>
                </span>
              </label>
              {/* Data consent */}
              <label onClick={() => toggle("data")} style={{
                display:"flex", alignItems:"flex-start", gap:11, padding:"11px 13px",
                borderRadius:13, cursor:"pointer", transition:"all 0.2s",
                background: showLegalError && !agreedData ? "rgba(248,113,113,.07)" : "rgba(255,255,255,.03)",
                border:`1px solid ${showLegalError && !agreedData ? "rgba(248,113,113,.5)" : agreedData ? "rgba(255,244,79,.3)" : "rgba(255,255,255,.08)"}`,
              }}>
                <div style={{
                  width:20, height:20, borderRadius:6, flexShrink:0,
                  background: agreedData ? "linear-gradient(135deg,#800020,#FFF44F)" : showLegalError && !agreedData ? "rgba(248,113,113,.15)" : "rgba(255,255,255,.06)",
                  border:`2px solid ${agreedData ? "#FFF44F" : showLegalError && !agreedData ? "#f87171" : "rgba(255,255,255,.15)"}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.2s", boxShadow: agreedData ? "0 0 9px rgba(255,244,79,.38)" : "none",
                }}>
                  {agreedData && <Check size={12} strokeWidth={3.5} color="#fff" />}
                </div>
                <span style={{ fontSize:11.5, color:"rgba(255,255,255,.6)", lineHeight:1.5, fontWeight:500 }}>
                  I consent to{" "}
                  <Link to="/data-info" onClick={(e) => e.stopPropagation()} style={{ color:"#FFF44F", fontWeight:700 }}>Data Collection</Link>
                  {" "}for a personalized social experience.
                </span>
              </label>
              <AnimatePresence>
                {showLegalError && (!agreedTerms || !agreedData) && (
                  <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                    style={{ margin:0, textAlign:"center", fontSize:12, fontWeight:700, color:"#f87171" }}>
                    ⚠️ Please accept the T&amp;C and Privacy Policy to continue.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Feedback messages */}
            <AnimatePresence>
              {(error || success) && (
                <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  style={{ margin:"0 0 12px", textAlign:"center", fontSize:12, fontWeight:700,
                    color: success ? "#34d399" : "#f87171" }}>
                  {success || error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Email / Forgot CTA */}
            <motion.button
              onClick={forgotMode ? handleForgotPassword : handleEmailAuth}
              disabled={emailLoading}
              whileTap={emailLoading ? {} : { scale:0.975 }}
              style={{
                width:"100%", padding:"14px 0", borderRadius:15,
                background: emailLoading
                  ? "rgba(255,255,255,.06)"
                  : "linear-gradient(135deg,#800020 0%,#5a0016 40%,#800020 100%)",
                border:`1.5px solid ${emailLoading ? "rgba(255,255,255,.08)" : "rgba(255,244,79,.4)"}`,
                cursor: emailLoading ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:9,
                color:"#FFF44F", fontSize:14, fontWeight:800, letterSpacing:0.3,
                opacity: emailLoading ? 0.65 : 1, transition:"all 0.2s",
                position:"relative", overflow:"hidden", marginBottom:10,
                boxShadow: emailLoading ? "none" : "0 0 22px rgba(128,0,32,.5),0 4px 20px rgba(0,0,0,.4)",
              }}>
              {!emailLoading && (
                <div style={{ position:"absolute", top:0, left:0, width:"40%", height:"100%",
                  background:"linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)",
                  animation:"shimmer 2.5s ease-in-out infinite", pointerEvents:"none" }} />
              )}
              {emailLoading
                ? <Loader2 size={18} style={{ animation:"spin 1s linear infinite" }} />
                : forgotMode
                  ? <><Mail size={15} /> Send Reset Link</>
                  : tab === "signin"
                    ? <><LogIn size={15} /> Sign In</>
                    : <><UserPlus size={15} /> Create Account</>
              }
            </motion.button>

            {/* Cancel forgot mode */}
            <AnimatePresence>
              {forgotMode && (
                <motion.button initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  onClick={() => { setForgotMode(false); setError(""); setSuccess(""); }}
                  style={{ width:"100%", padding:"9px 0", borderRadius:11, border:"1px solid rgba(255,255,255,.1)",
                    background:"transparent", color:"rgba(255,255,255,.4)", fontSize:12,
                    fontWeight:700, cursor:"pointer", marginBottom:10 }}>
                  ← Back to Sign In
                </motion.button>
              )}
            </AnimatePresence>

            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0 10px" }}>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,.08)" }} />
              <span style={{ fontSize:10, color:"rgba(255,255,255,.25)", fontWeight:700, letterSpacing:1.5 }}>OR</span>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,.08)" }} />
            </div>

            {/* Google Sign In */}
            <motion.button
              onClick={handleGoogle}
              disabled={loading}
              whileTap={loading ? {} : { scale:0.975 }}
              whileHover={loading ? {} : { scale:1.01 }}
              className={!loading ? "btn-glow" : ""}
              style={{
                width:"100%", padding:"13px 0", borderRadius:15,
                background: loading ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.08)",
                border:`1.5px solid ${loading ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.14)"}`,
                cursor: loading ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                opacity: loading ? 0.6 : 1, transition:"all 0.22s",
                marginBottom:14,
              }}>
              {loading
                ? <Loader2 size={18} color="#FFF44F" style={{ animation:"spin 1s linear infinite" }} />
                : <>
                    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink:0 }}>
                      <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span style={{ fontSize:14, fontWeight:800, color:"rgba(255,255,255,.85)", letterSpacing:0.2 }}>
                      Continue with Google
                    </span>
                  </>
              }
            </motion.button>

            {/* Trust badges */}
            <div style={{ display:"flex", justifyContent:"center", gap:14, flexWrap:"wrap" }}>
              {["🔐 Encrypted","🇮🇳 India Made","✦ Privacy First"].map((b) => (
                <span key={b} style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.25)", letterSpacing:.3 }}>{b}</span>
              ))}
            </div>
          </motion.div>

          <p style={{ marginTop:20, textAlign:"center", fontSize:10, color:"rgba(255,255,255,.16)",
            letterSpacing:"3px", fontWeight:600, textTransform:"uppercase" }}>
            Powered by VKT
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
