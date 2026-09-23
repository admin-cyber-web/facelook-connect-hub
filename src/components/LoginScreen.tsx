import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Loader2, Eye, EyeOff, Mail, Lock, UserPlus, LogIn,
  Smartphone, ShieldCheck, ChevronLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabaseClient";

type AuthMode = "login" | "signup" | "phone" | "forgot";
type PendingAction = "google" | AuthMode | null;

const LoginScreen = () => {
  // ── state ──────────────────────────────────────────────────────────────────
  const [showTerms,    setShowTerms]    = useState(false);
  const [pendingAction,setPending]      = useState<PendingAction>(null);
  const [authMode,     setAuthMode]     = useState<AuthMode | null>(null);

  const [agreedTerms,  setAgreedTerms]  = useState(false);
  const [agreedData,   setAgreedData]   = useState(false);
  const [showLegalErr, setShowLegalErr] = useState(false);
  const [shakeKey,     setShakeKey]     = useState(0);

  const [loading,      setLoading]      = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [confirmPass,  setConfirmPass]  = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const HERO_IMG = "/hero-bg.png";

  // ── helpers ────────────────────────────────────────────────────────────────
  const clearForm = () => {
    setError(""); setSuccess(""); setEmail(""); setPassword(""); setConfirmPass("");
  };

  // Called when any of the 4 main buttons is tapped
  const requestAction = (action: PendingAction) => {
    setPending(action);
    setShowLegalErr(false);
    setShowTerms(true);
  };

  const closeTerms = () => {
    setShowTerms(false);
    setPending(null);
    setShowLegalErr(false);
  };

  const closeAuth = () => {
    setAuthMode(null);
    clearForm();
  };

  const toggle = (which: "terms" | "data") => {
    if (which === "terms") setAgreedTerms((v) => !v);
    else setAgreedData((v) => !v);
    if (showLegalErr) setShowLegalErr(false);
  };

  // Called when user taps "Continue" inside Terms sheet
  const handleTermsContinue = async () => {
    if (!agreedTerms || !agreedData) {
      setShowLegalErr(true);
      setShakeKey((k) => k + 1);
      return;
    }
    setShowTerms(false);
    setShowLegalErr(false);

    if (pendingAction === "google") {
      // Immediately trigger Google OAuth — account picker pops up on device
      setLoading(true);
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: "https://flicksindia.online" },
        });
        if (error) { setError("Google sign-in failed: " + error.message); }
      } catch { setError("Something went wrong. Please try again."); }
      finally { setLoading(false); }
    } else if (pendingAction) {
      // Open the email/password auth sheet
      clearForm();
      setAuthMode(pendingAction as AuthMode);
    }
    setPending(null);
  };

  // ── email auth ─────────────────────────────────────────────────────────────
  const handleEmailAuth = async (mode: "login" | "signup") => {
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

  // ── shared input style ─────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "14px 14px 14px 44px",
    borderRadius: 14, boxSizing: "border-box",
    background: "rgba(255,255,255,0.06)",
    border: "1.5px solid rgba(255,255,255,0.12)",
    color: "#fff", fontSize: 15, fontWeight: 500, outline: "none",
    transition: "border-color 0.2s",
  };

  // ── legal checkbox rows (reusable) ─────────────────────────────────────────
  const LegalBoxes = () => (
    <div
      key={shakeKey}
      className={showLegalErr && (!agreedTerms || !agreedData) ? "legal-shake" : ""}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      {[
        {
          key: "terms" as const, checked: agreedTerms,
          err: showLegalErr && !agreedTerms,
          label: (
            <span>
              I agree to the{" "}
              <Link to="/terms" onClick={(e) => e.stopPropagation()} style={{ color: "#E91E63", fontWeight: 700 }}>Terms &amp; Conditions</Link>
              {" "}and{" "}
              <Link to="/privacy" onClick={(e) => e.stopPropagation()} style={{ color: "#E91E63", fontWeight: 700 }}>Privacy Policy</Link>
            </span>
          ),
        },
        {
          key: "data" as const, checked: agreedData,
          err: showLegalErr && !agreedData,
          label: (
            <span>
              I consent to{" "}
              <Link to="/data-info" onClick={(e) => e.stopPropagation()} style={{ color: "#E91E63", fontWeight: 700 }}>Data Collection</Link>
              {" "}for a personalized experience.
            </span>
          ),
        },
      ].map((item) => (
        <label
          key={item.key}
          onClick={() => toggle(item.key)}
          style={{
            display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
            borderRadius: 14, cursor: "pointer",
            background: item.err ? "rgba(233,30,99,0.06)" : item.checked ? "rgba(233,30,99,0.05)" : "rgba(255,255,255,0.04)",
            border: `1.5px solid ${item.err ? "rgba(233,30,99,0.5)" : item.checked ? "rgba(233,30,99,0.4)" : "rgba(255,255,255,0.1)"}`,
            transition: "all 0.2s",
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
            background: item.checked ? "linear-gradient(135deg,#E91E63,#FF5722)" : item.err ? "rgba(233,30,99,0.15)" : "rgba(255,255,255,0.07)",
            border: `2px solid ${item.checked ? "#E91E63" : item.err ? "rgba(233,30,99,0.7)" : "rgba(255,255,255,0.2)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: item.checked ? "0 0 10px rgba(233,30,99,0.4)" : "none",
          }}>
            {item.checked && <Check size={12} strokeWidth={3.5} color="#fff" />}
          </div>
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.55, fontWeight: 500 }}>
            {item.label}
          </span>
        </label>
      ))}

      <AnimatePresence>
        {showLegalErr && (!agreedTerms || !agreedData) && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ margin: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#E91E63" }}
          >
            ⚠️ Please accept both to continue.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: "100%", minHeight: "100dvh", background: "#000",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <Helmet>
        <title>Flicks India — Connect. Share. Love.</title>
        <meta name="robots" content="index, follow" />
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700;800&display=swap" rel="stylesheet" />
      </Helmet>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes legal-shake {
          0%,100% { transform: translateX(0); }
          15%  { transform: translateX(-7px); }
          30%  { transform: translateX(7px); }
          45%  { transform: translateX(-4px); }
          60%  { transform: translateX(4px); }
          75%  { transform: translateX(-2px); }
        }
        .legal-shake { animation: legal-shake 0.45s cubic-bezier(.36,.07,.19,.97) both; }
        input::placeholder { color: rgba(255,255,255,0.28); }
        input:-webkit-autofill, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #1a1a1a inset !important;
          -webkit-text-fill-color: #fff !important;
        }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* ── HERO IMAGE ──────────────────────────────────────────────────── */}
      <div style={{ position: "relative", flex: 1, minHeight: "62dvh", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${HERO_IMG})`,
          backgroundSize: "cover", backgroundPosition: "center top",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.96) 100%)",
        }} />
      </div>

      {/* ── BOTTOM BUTTONS PANEL ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "#0d0d0d", padding: "24px 20px",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        {/* Continue with Google */}
        <motion.button
          onClick={() => requestAction("google")}
          disabled={loading}
          whileTap={{ scale: 0.975 }}
          style={{
            width: "100%", padding: "15px 20px", borderRadius: 14,
            background: loading ? "rgba(255,255,255,0.85)" : "#fff",
            border: "none", cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            boxShadow: "0 2px 16px rgba(0,0,0,0.35)", transition: "all 0.2s",
          }}
        >
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

        {/* Continue with Phone */}
        <motion.button
          onClick={() => requestAction("phone")}
          whileTap={{ scale: 0.975 }}
          style={{
            width: "100%", padding: "15px 20px", borderRadius: 14,
            background: "#1a1a1a", border: "1.5px solid rgba(255,255,255,0.14)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            transition: "all 0.2s",
          }}
        >
          <Smartphone size={20} color="rgba(255,255,255,0.85)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Continue with Phone</span>
        </motion.button>

        {/* OR divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: 1.5 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        </div>

        {/* Log In + Sign Up */}
        <div style={{ display: "flex", gap: 10 }}>
          <motion.button
            onClick={() => requestAction("login")}
            whileTap={{ scale: 0.975 }}
            style={{
              flex: 1, padding: "15px 0", borderRadius: 14,
              background: "#1a1a1a", border: "1.5px solid rgba(255,255,255,0.18)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 16, fontWeight: 800, transition: "all 0.2s",
            }}
          >
            Log In
          </motion.button>

          <motion.button
            onClick={() => requestAction("signup")}
            whileTap={{ scale: 0.975 }}
            style={{
              flex: 1, padding: "15px 0", borderRadius: 14,
              background: "linear-gradient(135deg,#E91E63 0%,#FF5722 100%)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 16, fontWeight: 800,
              boxShadow: "0 4px 20px rgba(233,30,99,0.4)", transition: "all 0.2s",
            }}
          >
            Sign Up
          </motion.button>
        </div>

        {/* Safe footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 2 }}>
          <ShieldCheck size={15} color="rgba(255,255,255,0.28)" />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>
            Safe, Secure &amp; Private. Your privacy is our priority.
          </span>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════════════
          TERMS SHEET — shown first for ALL buttons
          ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showTerms && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeTerms}
              style={{ position: "fixed", inset: 0, zIndex: 190, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)" }}
            />

            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 34, stiffness: 380 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
                background: "#111", borderRadius: "26px 26px 0 0",
                padding: "0 22px",
                paddingBottom: "max(32px, env(safe-area-inset-bottom))",
                boxShadow: "0 -16px 60px rgba(0,0,0,0.8)",
              }}
            >
              {/* Handle */}
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, marginBottom: 20 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
              </div>

              {/* Icon + heading */}
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 18, margin: "0 auto 14px",
                  background: "linear-gradient(135deg,#E91E63,#FF5722)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 20px rgba(233,30,99,0.45)",
                }}>
                  <ShieldCheck size={26} color="#fff" />
                </div>
                <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#fff" }}>
                  Before you continue
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                  Please read and accept our terms to proceed.
                </p>
              </div>

              {/* Checkboxes */}
              <LegalBoxes />

              {/* Continue button */}
              <motion.button
                onClick={handleTermsContinue}
                whileTap={{ scale: 0.975 }}
                style={{
                  width: "100%", padding: "16px 0", borderRadius: 14, marginTop: 18,
                  background: agreedTerms && agreedData
                    ? "linear-gradient(135deg,#E91E63 0%,#FF5722 100%)"
                    : "rgba(255,255,255,0.08)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  color: "#fff", fontSize: 16, fontWeight: 800,
                  boxShadow: agreedTerms && agreedData ? "0 4px 24px rgba(233,30,99,0.45)" : "none",
                  transition: "all 0.25s",
                }}
              >
                {pendingAction === "google" ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continue with Google
                  </>
                ) : pendingAction === "signup" ? (
                  <><UserPlus size={18} /> Continue to Sign Up</>
                ) : pendingAction === "login" ? (
                  <><LogIn size={18} /> Continue to Log In</>
                ) : (
                  <><Smartphone size={18} /> Continue</>
                )}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════
          AUTH SHEET — email/password form (after terms agreed)
          ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {authMode !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeAuth}
              style={{ position: "fixed", inset: 0, zIndex: 190, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)" }}
            />

            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 34, stiffness: 380 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
                background: "#111", borderRadius: "26px 26px 0 0",
                padding: "0 22px",
                paddingBottom: "max(36px, env(safe-area-inset-bottom))",
                boxShadow: "0 -16px 60px rgba(0,0,0,0.8)",
                maxHeight: "88dvh", overflowY: "auto",
              }}
            >
              {/* Handle */}
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, marginBottom: 8 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
              </div>

              {/* Back */}
              <button onClick={closeAuth} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 600, padding: "6px 0", marginBottom: 16,
              }}>
                <ChevronLeft size={18} /> Back
              </button>

              {/* Title */}
              <h2 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: "#fff" }}>
                {authMode === "login"  && "Welcome back 👋"}
                {authMode === "signup" && "Create account ✨"}
                {authMode === "phone"  && "Sign in with Email"}
                {authMode === "forgot" && "Reset password 🔑"}
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                {authMode === "login"  && "Sign in to your Flicks India account"}
                {authMode === "signup" && "Join India's creator ecosystem"}
                {authMode === "phone"  && "Enter your email address below"}
                {authMode === "forgot" && "We'll send a reset link to your email"}
              </p>

              {/* Email */}
              <div style={{ position: "relative", marginBottom: 12 }}>
                <Mail size={16} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
                <input
                  ref={emailRef}
                  type="email" placeholder="Email address" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(233,30,99,0.6)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                  style={inputStyle}
                />
              </div>

              {/* Password */}
              {authMode !== "forgot" && (
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <Lock size={16} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
                  <input
                    type={showPass ? "text" : "password"} placeholder="Password"
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !emailLoading && handleEmailAuth(authMode === "signup" ? "signup" : "login")}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(233,30,99,0.6)"; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                    style={{ ...inputStyle, paddingRight: 44 }}
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
              {authMode === "signup" && (
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <Lock size={16} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
                  <input
                    type={showPass ? "text" : "password"} placeholder="Confirm password"
                    autoComplete="new-password"
                    value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !emailLoading && handleEmailAuth("signup")}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(233,30,99,0.6)"; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Forgot link */}
              {authMode === "login" && (
                <div style={{ textAlign: "right", marginBottom: 16 }}>
                  <button onClick={() => { clearForm(); setAuthMode("forgot"); }} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 700, color: "#E91E63",
                  }}>Forgot password?</button>
                </div>
              )}

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

              {/* CTA */}
              <motion.button
                onClick={authMode === "forgot" ? handleForgot : () => handleEmailAuth(authMode === "signup" ? "signup" : "login")}
                disabled={emailLoading}
                whileTap={emailLoading ? {} : { scale: 0.975 }}
                style={{
                  width: "100%", padding: "16px 0", borderRadius: 14,
                  background: emailLoading ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#E91E63 0%,#FF5722 100%)",
                  border: "none", cursor: emailLoading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                  color: "#fff", fontSize: 16, fontWeight: 800,
                  opacity: emailLoading ? 0.65 : 1,
                  boxShadow: emailLoading ? "none" : "0 4px 24px rgba(233,30,99,0.45)",
                  transition: "all 0.2s",
                }}
              >
                {emailLoading
                  ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                  : authMode === "forgot"
                    ? <><Mail size={17} /> Send Reset Link</>
                    : authMode === "signup"
                      ? <><UserPlus size={17} /> Create Account</>
                      : <><LogIn size={17} /> Log In</>
                }
              </motion.button>

              {/* Switch */}
              {(authMode === "login" || authMode === "signup") && (
                <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.38)" }}>
                  {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
                  <button
                    onClick={() => { clearForm(); setAuthMode(authMode === "login" ? "signup" : "login"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#E91E63", fontWeight: 700, fontSize: 13 }}
                  >
                    {authMode === "login" ? "Sign Up" : "Log In"}
                  </button>
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginScreen;
