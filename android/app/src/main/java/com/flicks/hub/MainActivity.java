package com.flicks.hub;

import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;


public class MainActivity extends BridgeActivity {

    private static final String TAG = "FlicksNative";
    private AndroidShareBridge shareBridge;
    private ScrollModeBridge scrollModeBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProximityBlePlugin.class);
        super.onCreate(savedInstanceState);

        // 🛑 NATIVE FIX: Force status bar window flags and solid background
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#0F172A"));
        }

        if (getBridge() != null) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setAllowFileAccessFromFileURLs(true);
                settings.setAllowUniversalAccessFromFileURLs(true);
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

                boolean isDebuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
                if (isDebuggable) {
                    WebView.setWebContentsDebuggingEnabled(true);
                }

                shareBridge = new AndroidShareBridge(this);
                webView.addJavascriptInterface(shareBridge, "AndroidShare");
                scrollModeBridge = new ScrollModeBridge(this, webView);
                webView.addJavascriptInterface(scrollModeBridge, "AndroidScroll");
                webView.addJavascriptInterface(new JSErrorLogger(), "AndroidErrorLogger");

                injectJavaScriptErrorHandlers(webView);
                
                getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        if (request != null && request.getUrl() != null) {
                            Uri url = request.getUrl();
                            String scheme = url.getScheme();
                            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                                return false;
                            }
                        }
                        return super.shouldOverrideUrlLoading(view, request);
                    }
                });

                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                webView.setVerticalScrollBarEnabled(true);
                webView.setHorizontalScrollBarEnabled(false);
            }
        }
    }

    private void injectJavaScriptErrorHandlers(WebView webView) {
        String jsErrorScript = "(function() {" +
                "  if (window.__flicksErrorLoggerInjected) return;" +
                "  window.__flicksErrorLoggerInjected = true;" +
                "  window.addEventListener('error', function(event) {" +
                "    var msg = event.message || (event.error && event.error.message) || 'Unknown Script Error';" +
                "    var source = event.filename || '';" +
                "    var line = event.lineno || 0;" +
                "    var col = event.colno || 0;" +
                "    var stack = (event.error && event.error.stack) ? event.error.stack : '';" +
                "    if (window.AndroidErrorLogger) {" +
                "      window.AndroidErrorLogger.logJsError(msg, source, line, col, stack);" +
                "    }" +
                "  });" +
                "  window.addEventListener('unhandledrejection', function(event) {" +
                "    var reason = event.reason;" +
                "    var msg = reason ? (reason.message || String(reason)) : 'Unhandled Promise Rejection';" +
                "    var stack = (reason && reason.stack) ? reason.stack : '';" +
                "    if (window.AndroidErrorLogger) {" +
                "      window.AndroidErrorLogger.logJsError('Unhandled Promise Rejection: ' + msg, '', 0, 0, stack);" +
                "    }" +
                "  });" +
                "})();";
        webView.evaluateJavascript(jsErrorScript, null);
    }

    @Override
    public void onDestroy() {
        if (shareBridge != null) {
            shareBridge.shutdown();
        }
        super.onDestroy();
    }

    public static final class JSErrorLogger {
        @JavascriptInterface
        public void logJsError(String message, String source, int line, int col, String stack) {
            Log.e(TAG, "Uncaught JS Exception: " + message + "\nSource: " + source + ":" + line + ":" + col + "\nStack: " + stack);
        }
    }

    public static final class ScrollModeBridge {
        private final MainActivity activity;
        private final WebView webView;

        ScrollModeBridge(MainActivity activity, WebView webView) {
            this.activity = activity;
            this.webView = webView;
        }

        @JavascriptInterface
        public void setFameFeedEnabled(final boolean enabled) {
            activity.runOnUiThread(() -> {
                if (webView == null) return;
                webView.setOverScrollMode(
                        enabled
                                ? View.OVER_SCROLL_IF_CONTENT_SCROLLS
                                : View.OVER_SCROLL_NEVER
                );
            });
        }
    }
}