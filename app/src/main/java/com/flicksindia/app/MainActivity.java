package com.flicksindia.app;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SmartSwipeRefreshLayout refreshLayout;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        refreshLayout = findViewById(R.id.refresh_layout);
        webView = findViewById(R.id.webview);
        WebSettings webSettings = webView.getSettings();

        // Zaroori settings taaki login aur website fast chale
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        webView.setNestedScrollingEnabled(true);
        webView.setVerticalScrollBarEnabled(false);

        // Cookies enable karo taaki Google Login yaad rahe
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        refreshLayout.setContentWebView(webView);
        refreshLayout.setOnRefreshListener(() -> webView.reload());
        webView.addJavascriptInterface(
                new ScrollControlBridge(new ScrollControlBridge.Listener() {
                    @Override
                    public void onSwipeEnabledChanged(boolean enabled) {
                        runOnUiThread(() -> refreshLayout.setSwipeEnabled(enabled));
                    }

                    @Override
                    public void onContentAtTopChanged(boolean atTop) {
                        runOnUiThread(() -> refreshLayout.setContentAtTop(atTop));
                    }
                }),
                "ScrollControl"
        );

        // App ke andar hi website chale, browser me na khule
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                refreshLayout.setRefreshing(false);
                super.onPageFinished(view, url);
            }
        });

        // Aapki live website ka URL
        webView.loadUrl("https://flicksindia.online");
    }

    // Phone ka Back button dabane par website me pichle page par jaye
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}