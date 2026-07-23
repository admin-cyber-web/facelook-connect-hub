import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Loader2, Eye, EyeOff, Mail, Lock, UserPlus, LogIn,
  Smartphone, ShieldCheck, X, ChevronLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabaseClient";

// ── SLIDE PANEL TYPES ────────────────────────────────────────────────────────
type Panel = "none" | "login" | "signup" | "phone" | "forgot";

// ── COMPONENT ────────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [panel,        setPanel]        = useState<Panel>("none");
  const [loading,      setLoading]      = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [confirmPass,  setConfirmPass]  = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [agreedTerms,  setAgreedTerms]  = useState(false);
  const [agreedData,   setAgreedData]   = useState(false);
  const [showLegal,    setShowLegal]    = useState(false);
  const [shakeKey,     setShakeKey]     = useState(0);
  const [dotIdx,       setDotIdx]       = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  const HERO_IMG = "/hero-bg.png";

  const SLIDES = [
    { heading: "Where Moments Meet Hearts", sub: "India's new way to connect through real stories and real people." },
    { heading: "Share. Earn. Shine.", sub: "Post your world, grow your circle, and build your digital fame." },
    { heading: "Real People. Real Love.", sub: "Connect authentically with millions across India." },
  ];

  const clearForm = () => {
    setError(""); setSuccess(""); setEmail(""); setPassword(""); setConfirmPass("");
  };

  const openPanel = (p: Panel) => { clearForm(); setPanel(p); };
  const closePanel = () => { clearForm(); setPanel("none"); };

  const checkLegal = () => {
    if (!agreedTerms || !agreedData) {
      setShowLegal(true);
      setShakeKey((k) => k + 1);
      return false;
    }
    setShowLegal(false);
    return true;
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    if (!checkLegal()) return;
    setLoading(true); setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: "https://flicksindia.online" },
      });
      if (error) setError("Google sign-in failed: " + error.message);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  // ── Email Auth ───────────────────────────────────────────────────────────
  const handleEmailAuth = async (mode: "login" | "signup") => {
    if (!checkLegal()) return;
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (mode === "signup" && password !== confirmPass) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setEmailLoading(true); setError("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) setError(error.message);
        else setSuccess("✅ Account created! Check your email to verify.");
      }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setEmailLoading(false); }
  };

  // ── Forgot Password ──────────────────────────────────────────────────────
  const handleForgot = async () => {
    if (!email.trim()) { setError("Enter your email first."); emailRef.current?.focus(); return; }
    setEmailLoading(true); setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://flicksindia.online/reset-password",
      });
      if (error) setError(error.message);
      else setSuccess("📧 Reset link sent! Check your inbox.");
    } catch { setError("Something went wrong. Try again."); }
    finally { setEmailLoading(false); }
  };

  const toggle = (which: "terms" | "data") => {
    if (which === "terms") setAgreedTerms((v) => !v);
    else setAgreedData((v) => !v);
    if (showLegal) setShowLegal(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SUB-COMPONENT: slide-up auth panel
  // ─────────────────────────────────────────────────────────────────────────
  const AuthSheet = ({ mode }: { mode: "login" | "signup" | "phone" | "forgot" }) => {
    const isLogin  = mode === "login";
    const isSignup = mode === "signup";
    const isPhone  = mode === "phone";
    const isForgot = mode === "forgot";

    return (
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 380 }}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
          background: "#0a0a0a",
          borderRadius: "28px 28px 0 0",
          padding: "0 22px 40px",
          paddingBottom: "max(40px, env(safe-area-inset-bottom))",
          boxShadow: "0 -12px 60px rgba(0,0,0,0.8)",
          maxHeight: "88dvh",
          overflowY: "auto",
        }}>

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, marginBottom: 8 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
        </div>

        {/* Back button */}
        <button onClick={closePanel} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, padding: "6px 0", marginBottom: 16,
        }}>
          <ChevronLeft size={18} /> Back
        </button>

        {/* Title */}
        <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 900, color: "#fff" }}>
          {isLogin  && "Welcome back 👋"}
          {isSignup && "Create account ✨"}
          {isPhone  && "Sign in with Email"}
          {isForgot && "Reset password 🔑"}
        </h2>
        <p style={{ margin: "0 0 22px", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          {isLogin  && "Sign in to your Flicks India account"}
          {isSignup && "Join India's creator ecosystem"}
          {isPhone  && "Enter your email address below"}
          {isForgot && "We'll send a link to your email"}
        </p>

        {/* Email field */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Mail size={16} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
          <input
            ref={emailRef}
            type="email"
            placeholder="Email address"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(233,30,99,0.6)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            style={{
              width: "100%", padding: "14px 14px 14px 44px",
              borderRadius: 14, boxSizing: "border-box",
              background: "rgba(255,255,255,0.06)",
              border: "1.5px solid rgba(255,255,255,0.12)",
              color: "#fff", fontSize: 15, fontWeight: 500, outline: "none",
              transition: "border-color 0.2s",
            }}
          />
        </div>

        {/* Password field */}
        {!isForgot && (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Lock size={16} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
            <input
              type={showPass ? "text" : "password"}
              placeholder="Password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !emailLoading && handleEmailAuth(isSignup ? "signup" : "login")}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(233,30,99,0.6)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              style={{
                width: "100%", padding: "14px 44px 14px 44px",
                borderRadius: 14, boxSizing: "border-box",
                background: "rgba(255,255,255,0.06)",
                border: "1.5px solid rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 15, fontWeight: 500, outline: "none",
                transition: "border-color 0.2s",
              }}
            />
            <button onClick={() => setShowPass((v) => !v)} style={{
              position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", padding: 0,
              color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center",
            }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        )}

        {/* Confirm password */}
        {isSignup && (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Lock size={16} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
            <input
              type={showPass ? "text" : "password"}
              placeholder="Confirm password"
              autoComplete="new-password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !emailLoading && handleEmailAuth("signup")}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(233,30,99,0.6)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              style={{
                width: "100%", padding: "14px 14px 14px 44px",
                borderRadius: 14, boxSizing: "border-box",
                background: "rgba(255,255,255,0.06)",
                border: "1.5px solid rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 15, fontWeight: 500, outline: "none",
                transition: "border-color 0.2s",
              }}
            />
          </div>
        )}

        {/* Forgot password link */}
        {isLogin && (
          <div style={{ textAlign: "right", marginBottom: 14 }}>
            <button onClick={() => openPanel("forgot")} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700, color: "#E91E63",
            }}>Forgot password?</button>
          </div>
        )}

        {/* Legal checkboxes */}
        <div key={shakeKey} className={showLegal && (!agreedTerms || !agreedData) ? "legal-shake" : ""}
          style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {[
            { key: "terms" as const, checked: agreedTerms,
              label: <span>I agree to the{" "}<Link to="/terms" onClick={(e) => e.stopPropagation()} style={{ color: "#E91E63", fontWeight: 700 }}>Terms &amp; Conditions</Link>{" "}and{" "}<Link to="/privacy" onClick={(e) => e.stopPropagation()} style={{ color: "#E91E63", fontWeight: 700 }}>Privacy Policy</Link></span>,
              err: showLegal && !agreedTerms },
            { key: "data" as const, checked: agreedData,
              label: <span>I consent to{" "}<Link to="/data-info" onClick={(e) => e.stopPropagation()} style={{ color: "#E91E63", fontWeight: 700 }}>Data Collection</Link>{" "}for a personalized experience.</span>,
              err: showLegal && !agreedData },
          ].map((item) => (
            <label key={item.key} onClick={() => toggle(item.key)} style={{
              display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
              borderRadius: 12, cursor: "pointer",
              background: item.err ? "rgba(233,30,99,0.06)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${item.err ? "rgba(233,30,99,0.4)" : item.checked ? "rgba(233,30,99,0.3)" : "rgba(255,255,255,0.08)"}`,
              transition: "all 0.2s",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                background: item.checked ? "linear-gradient(135deg,#E91E63,#FF5722)" : item.err ? "rgba(233,30,99,0.12)" : "rgba(255,255,255,0.06)",
                border: `2px solid ${item.checked ? "#E91E63" : item.err ? "#E91E63" : "rgba(255,255,255,0.15)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}>
                {item.checked && <Check size={11} strokeWidth={3.5} color="#fff" />}
              </div>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.58)", lineHeight: 1.5, fontWeight: 500 }}>
                {item.label}
              </span>
            </label>
          ))}
          <AnimatePresence>
            {showLegal && (!agreedTerms || !agreedData) && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ margin: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#E91E63" }}>
                ⚠️ Please accept the T&C and Privacy Policy to continue.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {(error || success) && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ margin: "0 0 12px", textAlign: "center", fontSize: 13, fontWeight: 700,
                color: success ? "#4CAF50" : "#f44336" }}>
              {success || error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* CTA Button */}
        <motion.button
          onClick={isForgot ? handleForgot : () => handleEmailAuth(isSignup ? "signup" : "login")}
          disabled={emailLoading}
          whileTap={emailLoading ? {} : { scale: 0.975 }}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 14,
            background: emailLoading
              ? "rgba(255,255,255,0.06)"
              : "linear-gradient(135deg,#E91E63 0%,#FF5722 100%)",
            border: "none",
            cursor: emailLoading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            color: "#fff", fontSize: 16, fontWeight: 800,
            opacity: emailLoading ? 0.65 : 1, transition: "all 0.2s",
            boxShadow: emailLoading ? "none" : "0 4px 24px rgba(233,30,99,0.45)",
            boxSizing: "border-box",
          }}>
          {emailLoading
            ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
            : isForgot
              ? <><Mail size={17} /> Send Reset Link</>
              : isSignup
                ? <><UserPlus size={17} /> Create Account</>
                : <><LogIn size={17} /> {isPhone ? "Continue" : "Log In"}</>
          }
        </motion.button>

        {/* Switch link */}
        {(isLogin || isSignup) && (
          <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.38)" }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => openPanel(isLogin ? "signup" : "login")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#E91E63", fontWeight: 700, fontSize: 13,
            }}>{isLogin ? "Sign Up" : "Log In"}</button>
          </p>
        )}
      </motion.div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: "100%", minHeight: "100dvh",
      background: "#000",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <Helmet>
        <title>Flicks India — Connect. Share. Love.</title>
        <meta name="robots" content="index, follow" />
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700;800&family=Playfair+Display:ital,wght@1,700&display=swap" rel="stylesheet" />
      </Helmet>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes legal-shake {
          0%,100% { transform:translateX(0); }
          15% { transform:translateX(-6px); }
          30% { transform:translateX(6px); }
          45% { transform:translateX(-4px); }
          60% { transform:translateX(4px); }
          75% { transform:translateX(-2px); }
        }
        .legal-shake { animation: legal-shake 0.45s cubic-bezier(.36,.07,.19,.97) both; }
        input::placeholder { color: rgba(255,255,255,0.28); }
        input:-webkit-autofill, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #1a1a1a inset !important;
          -webkit-text-fill-color: #fff !important;
        }
        ::-webkit-scrollbar { width: 0; }
        .flicks-logo { font-family: 'Dancing Script', cursive; }
        @keyframes bgSlide {
          0%,33% { opacity: 1; }
          38%,95% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes birdsFloat {
          0% { transform: translateX(-10px) translateY(0px); opacity: 0.7; }
          50% { transform: translateX(10px) translateY(-8px); opacity: 1; }
          100% { transform: translateX(-10px) translateY(0px); opacity: 0.7; }
        }
      `}</style>

      {/* ── HERO IMAGE SECTION ──────────────────────────────────────────── */}
      <div style={{
        position: "relative", flex: 1,
        minHeight: "62dvh",
        overflow: "hidden",
      }}>
        {/* Background image */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${HERO_IMG})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }} />

        {/* Gradient overlay: top fade for logo, bottom fade for text */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 52%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0.92) 100%)",
        }} />

        {/* ── TOP LOGO ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute", top: 0, left: 0, right: 0,
            paddingTop: "max(44px, env(safe-area-inset-top))",
            display: "flex", flexDirection: "column", alignItems: "center",
          }}>

          {/* "flicks" cursive */}
          <div className="flicks-logo" style={{
            fontSize: 52, fontWeight: 800, lineHeight: 1,
            color: "#FF4081",
            textShadow: "0 2px 20px rgba(233,30,99,0.5)",
            letterSpacing: -1,
          }}>
            flicks
          </div>

          {/* "—india—" */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginTop: 2, marginBottom: 10,
          }}>
            <div style={{ width: 28, height: 1.5, background: "#D4A843" }} />
            <span style={{
              fontSize: 16, fontWeight: 700, color: "#D4A843",
              letterSpacing: 4, textTransform: "lowercase",
              fontFamily: "'Dancing Script', cursive",
            }}>india</span>
            <div style={{ width: 28, height: 1.5, background: "#D4A843" }} />
          </div>

          {/* Taglines */}
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: 500, letterSpacing: 0.3 }}>
            Connect. Share. Love.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 400 }}>
            Real people,{" "}
            <span style={{ color: "#FF4081", fontWeight: 700 }}>real moments.</span>
          </p>
        </motion.div>

        {/* ── BOTTOM TEXT OVERLAY ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "0 28px 24px",
            textAlign: "center",
          }}>

          {/* "Where Moments Meet Hearts" */}
          <h2 style={{
            margin: "0 0 8px",
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.25,
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}>
            Where{" "}
            <span style={{
              fontFamily: "'Dancing Script', cursive",
              fontWeight: 700,
              fontSize: 32,
              color: "#fff",
            }}>Moments</span>{" "}
            Meet{" "}
            <span style={{
              fontFamily: "'Dancing Script', cursive",
              fontWeight: 700,
              fontSize: 32,
              color: "#FF4081",
              textShadow: "0 2px 16px rgba(233,30,99,0.6)",
            }}>Hearts</span>
            <span style={{ fontSize: 20, marginLeft: 4 }}>🤍</span>
          </h2>

          <p style={{
            margin: "0 0 16px",
            fontSize: 13.5,
            color: "rgba(255,255,255,0.78)",
            lineHeight: 1.5,
            fontWeight: 400,
          }}>
            {SLIDES[dotIdx].sub}
          </p>

          {/* Dot indicators */}
          <div style={{ display: "flex", justifyContent: "center", gap: 7 }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setDotIdx(i)}
                style={{
                  width: i === dotIdx ? 20 : 7,
                  height: 7,
                  borderRadius: 4,
                  background: i === dotIdx ? "#E91E63" : "rgba(255,255,255,0.38)",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── BOTTOM DARK PANEL ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "#0d0d0d",
          padding: "24px 20px",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>

        {/* Continue with Google */}
        <motion.button
          onClick={handleGoogle}
          disabled={loading}
          whileTap={{ scale: 0.975 }}
          style={{
            width: "100%", padding: "15px 20px", borderRadius: 14,
            background: loading ? "rgba(255,255,255,0.85)" : "#fff",
            border: "none", cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            boxSizing: "border-box",
            boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
            transition: "all 0.2s",
          }}>
          {loading
            ? <Loader2 size={20} color="#555" style={{ animation: "spin 1s linear infinite" }} />
            : <>
                <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Continue with Google</span>
              </>
          }
        </motion.button>

        {/* Continue with Phone (Email) */}
        <motion.button
          onClick={() => openPanel("phone")}
          whileTap={{ scale: 0.975 }}
          style={{
            width: "100%", padding: "15px 20px", borderRadius: 14,
            background: "#1a1a1a",
            border: "1.5px solid rgba(255,255,255,0.14)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            boxSizing: "border-box",
            transition: "all 0.2s",
          }}>
          <Smartphone size={20} color="rgba(255,255,255,0.85)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
            Continue with Phone
          </span>
        </motion.button>

        {/* OR divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "2px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: 1.5 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        </div>

        {/* Log In + Sign Up row */}
        <div style={{ display: "flex", gap: 10 }}>
          <motion.button
            onClick={() => openPanel("login")}
            whileTap={{ scale: 0.975 }}
            style={{
              flex: 1, padding: "15px 0", borderRadius: 14,
              background: "#1a1a1a",
              border: "1.5px solid rgba(255,255,255,0.18)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 16, fontWeight: 800,
              transition: "all 0.2s",
            }}>
            Log In
          </motion.button>

          <motion.button
            onClick={() => openPanel("signup")}
            whileTap={{ scale: 0.975 }}
            style={{
              flex: 1, padding: "15px 0", borderRadius: 14,
              background: "linear-gradient(135deg,#E91E63 0%,#FF5722 100%)",
              border: "none",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 16, fontWeight: 800,
              boxShadow: "0 4px 20px rgba(233,30,99,0.4)",
              transition: "all 0.2s",
            }}>
            Sign Up
          </motion.button>
        </div>

        {/* Safe & Secure footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          marginTop: 4,
        }}>
          <ShieldCheck size={15} color="rgba(255,255,255,0.3)" />
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
              Safe, Secure &amp; Private.{" "}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", fontWeight: 400 }}>
              Your privacy is our priority.
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── SLIDE-UP AUTH PANELS ─────────────────────────────────────────── */}
      <AnimatePresence>
        {panel !== "none" && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closePanel}
              style={{
                position: "fixed", inset: 0, zIndex: 190,
                background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
              }}
            />
            <AuthSheet mode={panel} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginScreen;
