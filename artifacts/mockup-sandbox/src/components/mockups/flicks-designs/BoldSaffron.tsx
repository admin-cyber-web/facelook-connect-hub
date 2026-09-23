export function BoldSaffron() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#fff",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Top saffron strip */}
      <div style={{
        width: "100%",
        background: "linear-gradient(135deg, #FF6B00 0%, #FF9500 50%, #FFB800 100%)",
        padding: "56px 24px 48px",
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Ashoka chakra watermark */}
        <div style={{
          position: "absolute", right: -30, top: -30,
          width: 180, height: 180, opacity: 0.12,
          fontSize: 180, lineHeight: 1, userSelect: "none",
        }}>☸</div>

        {/* Tricolor accent lines */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", height: 6 }}>
          <div style={{ flex: 1, background: "#FF6B00" }} />
          <div style={{ flex: 1, background: "#fff" }} />
          <div style={{ flex: 1, background: "#138808" }} />
        </div>

        {/* Logo */}
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          marginBottom: 16,
        }}>
          <span style={{
            fontSize: 38, fontWeight: 900,
            background: "linear-gradient(135deg, #FF6B00, #FF9500)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>F</span>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-1px", textShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            Flicks India
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", letterSpacing: "3px", fontWeight: 700, marginTop: 3 }}>
            भारत का अपना सोशल ऐप
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, width: "100%", padding: "36px 24px 40px", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Tagline */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111", lineHeight: 1.3 }}>
            Connect the Unconnected.
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3,
            background: "linear-gradient(90deg, #FF6B00, #FF9500)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Discover the Real You.
          </div>
        </div>

        {/* Feature grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", marginBottom: 28 }}>
          {[
            { icon: "🎬", title: "Flicks Reels", color: "#FF6B00" },
            { icon: "👥", title: "Circles", color: "#138808" },
            { icon: "🧲", title: "MAGNET", color: "#000080" },
            { icon: "🎮", title: "Quiz Battle", color: "#FF6B00" },
          ].map(f => (
            <div key={f.title} style={{
              background: "#f8f8f8",
              borderRadius: 16, padding: "16px 14px",
              display: "flex", alignItems: "center", gap: 10,
              borderLeft: `4px solid ${f.color}`,
            }}>
              <span style={{ fontSize: 22 }}>{f.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{f.title}</span>
            </div>
          ))}
        </div>

        {/* Consent checkboxes */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {[
            "I agree to the Terms & Conditions and Privacy Policy.",
            "I consent to Data Collection for a personalized social experience.",
          ].map((text, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "#f9f9f9",
              border: "1.5px solid #eee",
              borderRadius: 14, padding: "14px 16px",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                border: "2px solid #FF9500",
                background: "rgba(255,149,0,0.08)",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: "#444", lineHeight: 1.4 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button style={{
          width: "100%", padding: "17px 0", borderRadius: 14,
          background: "#fff",
          border: "2px solid #e5e7eb",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#111" }}>Sign In with Google</span>
        </button>

        {/* Bottom accent */}
        <div style={{ marginTop: 32, display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 28, height: 3, borderRadius: 99, background: "#FF6B00" }} />
          <div style={{ width: 28, height: 3, borderRadius: 99, background: "#fff", border: "1px solid #eee" }} />
          <div style={{ width: 28, height: 3, borderRadius: 99, background: "#138808" }} />
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "#bbb", letterSpacing: "2px" }}>POWERED BY VKT</div>
      </div>
    </div>
  );
}
