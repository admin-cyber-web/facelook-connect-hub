export function GlassGradient() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #e8eaff 0%, #fce4f5 40%, #e4f0ff 100%)",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 0 40px 0",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Blob decorations */}
      <div style={{
        position: "absolute", top: -100, right: -80,
        width: 300, height: 300,
        background: "radial-gradient(circle, rgba(167,139,250,0.35) 0%, transparent 70%)",
        borderRadius: "50%", filter: "blur(10px)",
      }} />
      <div style={{
        position: "absolute", bottom: -60, left: -80,
        width: 260, height: 260,
        background: "radial-gradient(circle, rgba(251,182,206,0.4) 0%, transparent 70%)",
        borderRadius: "50%", filter: "blur(10px)",
      }} />
      <div style={{
        position: "absolute", top: "40%", left: -40,
        width: 180, height: 180,
        background: "radial-gradient(circle, rgba(96,165,250,0.25) 0%, transparent 70%)",
        borderRadius: "50%",
      }} />

      {/* Logo */}
      <div style={{ marginTop: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 90, height: 90, borderRadius: 28,
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1.5px solid rgba(255,255,255,0.9)",
          boxShadow: "0 8px 40px rgba(139,92,246,0.2), 0 2px 8px rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 38, fontWeight: 900,
          background2: "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)",
        }}>
          <span style={{
            background: "linear-gradient(135deg, #7c3aed, #db2777)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontWeight: 900, fontSize: 42,
          }}>F</span>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 32, fontWeight: 900, letterSpacing: "-1px",
            background: "linear-gradient(135deg, #7c3aed 0%, #db2777 60%, #2563eb 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Flicks</div>
          <div style={{ fontSize: 12, color: "#9ca3af", letterSpacing: "3px", fontWeight: 600, marginTop: 2 }}>
            YOUR WORLD, YOUR STORY
          </div>
        </div>
      </div>

      {/* Glass tagline card */}
      <div style={{
        marginTop: 28, padding: "20px 28px", borderRadius: 24,
        background: "rgba(255,255,255,0.5)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1.5px solid rgba(255,255,255,0.8)",
        boxShadow: "0 4px 24px rgba(139,92,246,0.1)",
        textAlign: "center", marginLeft: 24, marginRight: 24,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1e1b4b", lineHeight: 1.4 }}>
          Connect the Unconnected.
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, lineHeight: 1.4,
          background: "linear-gradient(90deg, #7c3aed, #db2777)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Discover the Real You.
        </div>
      </div>

      {/* Feature row */}
      <div style={{ display: "flex", gap: 8, marginTop: 22, flexWrap: "wrap", justifyContent: "center", padding: "0 20px" }}>
        {[
          { icon: "🎬", label: "Reels", color: "#7c3aed" },
          { icon: "💬", label: "Circles", color: "#db2777" },
          { icon: "🧲", label: "MAGNET", color: "#2563eb" },
          { icon: "🎮", label: "Quiz", color: "#059669" },
        ].map(f => (
          <div key={f.label} style={{
            padding: "8px 14px", borderRadius: 99,
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(10px)",
            border: "1.5px solid rgba(255,255,255,0.9)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            fontSize: 12, fontWeight: 700,
            color: f.color, display: "flex", alignItems: "center", gap: 5,
          }}>
            <span>{f.icon}</span> {f.label}
          </div>
        ))}
      </div>

      {/* Consent */}
      <div style={{ marginTop: 32, width: "100%", padding: "0 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          "I agree to the Terms & Conditions and Privacy Policy.",
          "I consent to Data Collection for a personalized social experience.",
        ].map((text, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1.5px solid rgba(255,255,255,0.85)",
            borderRadius: 16, padding: "14px 16px",
            boxShadow: "0 2px 10px rgba(139,92,246,0.07)",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 99,
              border: "2px solid #a78bfa",
              background: "rgba(167,139,250,0.15)",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.4 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Sign In Button */}
      <div style={{ marginTop: 24, width: "100%", padding: "0 24px" }}>
        <button style={{
          width: "100%", padding: "16px 0", borderRadius: 18,
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1.5px solid rgba(255,255,255,0.95)",
          boxShadow: "0 8px 30px rgba(139,92,246,0.18), 0 2px 8px rgba(0,0,0,0.06)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#1e1b4b", letterSpacing: 0.2 }}>
            Sign In with Google
          </span>
        </button>
      </div>

      <div style={{ marginTop: 32, fontSize: 11, color: "rgba(0,0,0,0.25)", letterSpacing: "2px" }}>
        POWERED BY VKT
      </div>
    </div>
  );
}
