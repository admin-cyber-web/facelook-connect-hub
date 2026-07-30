import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import OneSignal from "react-onesignal";

OneSignal.init({
  appId: "cee03105-9658-4f06-98fa-70957cb0e1cf",
  allowLocalhostAsSecureOrigin: true,
  serviceWorkerPath: "/OneSignalSDKWorker.js",
  notifyButton: { enable: false },
}).catch((err) => console.warn("[OneSignal] init error:", err));

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
