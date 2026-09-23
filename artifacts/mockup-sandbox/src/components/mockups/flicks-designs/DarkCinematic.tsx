export function DarkCinematic() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0a0a0f 0%, #0d0d1a 40%, #0a0f1a 100%)",
        fontFamily: "'Inter', sans-serif",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 0 40px 0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow orbs */}
      <div style={{
        position: "absolute", top: "-80px", left: "50%", transform: "translateX(-50%)",
        width: "340px", height: "340px",
        background: "radial-gradient(circle, rgba(99,57,255,0.18) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "80px", right: "-60px",
        width: "220px", height: "220px",
        background: "radial-gradient(circle, rgba(255,60,120,0.12) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none",
      }} />

      {/* Logo area */}
      <div style={{ marginTop: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: "linear-gradient(135deg, #6339ff 0%, #ff3c78 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, fontWeight: 900, letterSpacing: -1,
          boxShadow: "0 0 40px rgba(99,57,255,0.5), 0 0 80px rgba(255,60,120,0.2)",
        }}>F</div>

        <div style={{ textAlign: "center", marginTop: 4 }}>
          <div style={{
            fontSize: 34, fontWeight: 900, letterSpacing: "-1.5px",
            background: "linear-gradient(90deg, #fff 40%, #9d7fff 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>FLICKS</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "4px", marginTop: 2 }}>
            INDIA'S OWN SOCIAL UNIVERSE
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div style={{ marginTop: 32, textAlign: "center", padding: "0 32px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35, color: "#fff" }}>
          Connect the Unconnected.
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35,
          background: "linear-gradient(90deg, #6339ff, #ff3c78)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Discover the Real You.
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap", justifyContent: "center", padding: "0 24px" }}>
        {["🎬 Flicks Reels", "💬 Circles", "🎯 MAGNET", "🎮 Quiz Battle"].map(f => (
          <div key={f} style={{
            padding: "6px 14px", borderRadius: 99,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600,
          }}>{f}</div>
        ))}
      </div>

      {/* Consent cards */}
      <div style={{ marginTop: 40, width: "100%", padding: "0 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { label: "I agree to the Terms & Conditions and Privacy Policy." },
          { label: "I consent to Data Collection for a personalized social experience." },
        ].map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14, padding: "14px 16px",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 99,
              border: "2px solid rgba(99,57,255,0.6)",
              background: "rgba(99,57,255,0.1)",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <div style={{ marginTop: 28, width: "100%", padding: "0 24px" }}>
        <button style={{
          width: "100%", padding: "16px 0", borderRadius: 16,
          background: "linear-gradient(135deg, #6339ff 0%, #ff3c78 100%)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(99,57,255,0.4)",
        }}>
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="white" fillOpacity="0.15"/>
            <path d="M24 10C16.268 10 10 16.268 10 24C10 31.732 16.268 38 24 38C31.732 38 38 31.732 38 24C38 16.268 31.732 10 24 10Z" fill="white"/>
            <path d="M15 24C15 19.029 19.029 15 24 15C26.386 15 28.558 15.9 30.192 17.408L27.364 20.236C26.45 19.394 25.282 18.9 24 18.9C21.186 18.9 18.9 21.186 18.9 24C18.9 26.814 21.186 29.1 24 29.1C26.4 29.1 28.41 27.558 29.01 25.44H24V21.54H33.27C33.39 22.176 33.45 22.842 33.45 23.55C33.45 28.965 29.715 32.85 24 32.85C19.029 32.85 15 28.821 15 24Z" fill="#4285F4"/>
          </svg>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: 0.2 }}>
            Sign In with Google
          </span>
        </button>
      </div>

      {/* Bottom credits */}
      <div style={{ marginTop: 36, fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "2px" }}>
        POWERED BY VKT
      </div>
    </div>
  );
}
