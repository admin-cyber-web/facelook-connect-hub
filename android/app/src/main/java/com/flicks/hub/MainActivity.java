package com.flicks.hub;

import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private AndroidShareBridge shareBridge;
    private ScrollModeBridge scrollModeBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProximityBlePlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            shareBridge = new AndroidShareBridge(this);
            webView.addJavascriptInterface(shareBridge, "AndroidShare");
            scrollModeBridge = new ScrollModeBridge(this, webView);
            webView.addJavascriptInterface(scrollModeBridge, "AndroidScroll");
            // Start with native overscroll disabled until React confirms the Fame Feed route.
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(true);
            webView.setHorizontalScrollBarEnabled(false);
        }
    }

    @Override
    protected void onDestroy() {
        if (shareBridge != null) {
            shareBridge.shutdown();
        }
        super.onDestroy();
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
