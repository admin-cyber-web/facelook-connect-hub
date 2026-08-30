import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

// ── Capacitor Android: tag <html> so CSS can apply platform-aware safe-area
//    minimums. Must run before React renders so the CSS variable is live.
(function detectCapacitorPlatform() {
  try {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    document.documentElement.classList.add("cap-native");
    if (cap.getPlatform?.() === "android") {
      document.documentElement.classList.add("cap-android");
    }
  } catch {
    // non-Capacitor environment — safe to ignore
  }
})();

// OneSignal is loaded via CDN script in index.html.
// Only initialise on the production domain — skip silently on Replit dev / localhost.
const ONESIGNAL_DOMAIN = "flicksindia.online";
if (window.location.hostname === ONESIGNAL_DOMAIN) {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId: "cee03105-9658-4f06-98fa-70957cb0e1cf",
        serviceWorkerPath: "/OneSignalSDKWorker.js",
        notifyButton: { enable: false },
      });
    } catch (err) {
      console.warn("[OneSignal] init error:", err);
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary
    fallback={
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif", background: "#fafafa" }}>
        <h2 style={{ fontWeight: 900, color: "#dc2626", marginBottom: 8 }}>Kuch galat ho gaya</h2>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16, textAlign: "center" }}>
          App temporarily ruk gaya. Page reload kijiye.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "10px 24px", background: "#2563eb", color: "white", borderRadius: 999, fontWeight: 700, border: "none", cursor: "pointer" }}
        >
          Reload
        </button>
      </div>
    }
  >
    <App />
  </ErrorBoundary>
);
