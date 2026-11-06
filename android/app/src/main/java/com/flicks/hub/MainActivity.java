package com.flicks.hub;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    private static final String TAG = "FlicksNative";
    private AndroidShareBridge shareBridge;
    private ScrollModeBridge scrollModeBridge;

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Interface requirement for @capgo/capacitor-social-login plugin
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register plugins after super.onCreate(savedInstanceState) to ensure bridge is initialized
        registerPlugin(ProximityBlePlugin.class);
        registerPlugin(SocialLoginPlugin.class);

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

                            // Intercept deep link intents (e.g. whatsapp://, intent://, tg://, fb-messenger://)
                            if (scheme != null && ("whatsapp".equalsIgnoreCase(scheme) || "intent".equalsIgnoreCase(scheme)
                                    || "tg".equalsIgnoreCase(scheme) || "fb-messenger".equalsIgnoreCase(scheme))) {
                                try {
                                    Intent intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                                    if (intent != null) {
                                        view.getContext().startActivity(intent);
                                        return true;
                                    }
                                } catch (Exception e) {
                                    Log.w(TAG, "Deep link intent error: " + e.getMessage());
                                }
                            }

                            // Intercept social share web URLs so Android opens them in the external app/browser
                            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                                String host = url.getHost() != null ? url.getHost().toLowerCase() : "";
                                if (host.contains("whatsapp.com") || host.contains("facebook.com") || host.contains("twitter.com")
                                        || host.contains("t.me") || host.contains("telegram.me")) {
                                    try {
                                        Intent intent = new Intent(Intent.ACTION_VIEW, url);
                                        view.getContext().startActivity(intent);
                                        return true;
                                    } catch (ActivityNotFoundException e) {
                                        Log.w(TAG, "External share app not found for URL: " + url);
                                    }
                                }
                                return false; // Stay inside webview for regular app pages
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
