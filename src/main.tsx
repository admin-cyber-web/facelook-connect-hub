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

// Keep the web pull-to-refresh gesture scoped to the actual scroll surface
// under the user's finger. Native Android refresh is deliberately not allowed
// to intercept WebView gestures; this handler gives the app the same behavior
// without a parent ViewGroup stealing the touch stream.
(function syncNativeScrollPosition() {
  const getScrollSurface = (target: EventTarget | null): HTMLElement | null => {
    let node = target instanceof HTMLElement ? target : null;
    while (node && node !== document.body) {
      const styles = window.getComputedStyle(node);
      if (
        (styles.overflowY === "auto" || styles.overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return node as HTMLElement;
      }
      node = node.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
  };

  let chatOwnsGesture = false;
  let pullStartY = 0;
  let pullStartX = 0;
  let pullSurface: HTMLElement | null = null;
  let pullEligible = false;
  let pullTriggered = false;

  window.addEventListener("flicks-chat-gesture", (event) => {
    chatOwnsGesture = (event as CustomEvent<{ open?: boolean }>).detail?.open === true;
    pullEligible = false;
    pullSurface = null;
  });

  const reportPosition = (target: EventTarget | null) => {
    const control = (window as any).ScrollControl;
    if (!control?.setContentAtTop) return;
    const surface = getScrollSurface(target);
    control.setContentAtTop(!surface || surface.scrollTop <= 1);
  };

  document.addEventListener(
    "touchstart",
    (event) => {
      reportPosition(event.target);
      pullTriggered = false;
      pullSurface = getScrollSurface(event.target);
      pullEligible =
        !chatOwnsGesture &&
        (!pullSurface || pullSurface.scrollTop <= 1);
      if (pullEligible) {
        pullStartY = event.touches[0]?.clientY ?? 0;
        pullStartX = event.touches[0]?.clientX ?? 0;
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "touchmove",
    (event) => {
      if (!pullEligible || pullTriggered || chatOwnsGesture) return;
      const touch = event.touches[0];
      if (!touch) return;
      const deltaY = touch.clientY - pullStartY;
      const deltaX = touch.clientX - pullStartX;
      if (
        deltaY > 12 &&
        Math.abs(deltaY) > Math.abs(deltaX) &&
        (!pullSurface || pullSurface.scrollTop <= 1)
      ) {
        // Keep this passive and non-canceling: WebView remains responsible for
        // the actual scroll while we only recognize a pull gesture.
        reportPosition(event.target);
      } else if (deltaY < -12 || Math.abs(deltaX) > Math.abs(deltaY)) {
        pullEligible = false;
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "touchend",
    (event) => {
      if (!pullEligible || pullTriggered || chatOwnsGesture) return;
      const touch = event.changedTouches[0];
      const deltaY = (touch?.clientY ?? 0) - pullStartY;
      const deltaX = (touch?.clientX ?? 0) - pullStartX;
      if (
        deltaY >= 72 &&
        Math.abs(deltaY) > Math.abs(deltaX) * 1.2 &&
        (!pullSurface || pullSurface.scrollTop <= 1)
      ) {
        pullTriggered = true;
        window.dispatchEvent(new CustomEvent("flicks-pull-refresh"));
      }
      pullEligible = false;
      pullSurface = null;
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "touchcancel",
    () => {
      pullEligible = false;
      pullSurface = null;
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "scroll",
    (event) => reportPosition(event.target),
    { capture: true, passive: true },
  );
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
