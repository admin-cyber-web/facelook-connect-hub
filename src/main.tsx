import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installGlobalInteractionIsolation } from "./lib/globalInteractionIsolation";
// eruda is a dev-only console; it must never ship in a release build.
if (import.meta.env.DEV && typeof window !== "undefined") {
  void import("eruda").then(({ default: eruda }) => eruda.init());
}

const cleanupInteractionIsolation = installGlobalInteractionIsolation();
if (import.meta.hot) {
  import.meta.hot.dispose(cleanupInteractionIsolation);
}

// OneSignal is loaded via CDN script in index.html.
// Only initialise on the production web domain — skip on localhost/dev and in
// the native shell (native push needs the OneSignal plugin, not wired yet).
const ONESIGNAL_HOSTS = ["flicksindia.online", "www.flicksindia.online"];
const isNativeShell = Boolean(window.Capacitor?.isNativePlatform?.());
if (ONESIGNAL_HOSTS.includes(window.location.hostname) && !isNativeShell) {
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
