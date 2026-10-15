package com.flicksindia.app;

import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private AndroidShareBridge shareBridge;
    private AndroidRefreshBridge refreshBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        swipeRefreshLayout = findViewById(R.id.swipe_refresh);
        swipeRefreshLayout.setEnabled(true);
        
        // Prevent white screen flash by setting canvas background color immediately
        webView.setBackgroundColor(Color.parseColor("#0F172A"));

        WebSettings webSettings = webView.getSettings();

        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        shareBridge = new AndroidShareBridge(this);
        webView.addJavascriptInterface(shareBridge, "AndroidShare");
        refreshBridge = new AndroidRefreshBridge();
        webView.addJavascriptInterface(refreshBridge, "AndroidBridge");

        // Let SwipeRefreshLayout own only downward gestures at the top of the WebView.
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(true);
        webView.setHorizontalScrollBarEnabled(false);

        swipeRefreshLayout.setOnRefreshListener(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('flicks-pull-refresh', {detail: {native: true}}));",
                null
        ));

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Ensure all web content loads strictly inside native WebView container without address bar or browser UI
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null) {
                    String scheme = uri.getScheme();
                    // Keep http and https URLs strictly inside the WebView
                    if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                        return false;
                    }
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        webView.loadUrl("https://flicksindia.online");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (shareBridge != null) {
            shareBridge.shutdown();
        }
        super.onDestroy();
    }

    public final class AndroidRefreshBridge {
        @JavascriptInterface
        public void setPullToRefresh(final boolean enabled) {
            runOnUiThread(() -> {
                if (swipeRefreshLayout == null) return;
                swipeRefreshLayout.setEnabled(enabled);
                if (!enabled) {
                    swipeRefreshLayout.setRefreshing(false);
                }
            });
        }

        @JavascriptInterface
        public void onPullToRefreshComplete() {
            runOnUiThread(() -> {
                if (swipeRefreshLayout != null) {
                    swipeRefreshLayout.setRefreshing(false);
                }
            });
        }
    }
}
