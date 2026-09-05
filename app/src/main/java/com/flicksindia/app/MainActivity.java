package com.flicksindia.app;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SmartSwipeRefreshLayout refreshLayout;
    private float touchDownY;
    private final int touchSlop = 8;

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

        webView.setOnTouchListener((view, event) -> {
            int action = event.getActionMasked();
            if (action == MotionEvent.ACTION_DOWN) {
                touchDownY = event.getY();
                syncActiveScrollPosition(event);
                // Keep every new gesture in the WebView until it is proven to
                // be an intentional pull from the active surface's top.
                setParentInterception(view, true);
            } else if (action == MotionEvent.ACTION_MOVE) {
                syncActiveScrollPosition(event);
                float deltaY = event.getY() - touchDownY;
                boolean allowNativePull = deltaY > touchSlop
                        && refreshLayout.isSwipeEnabled()
                        && refreshLayout.isContentAtTop()
                        && !webView.canScrollVertically(-1);
                setParentInterception(view, !allowNativePull);
            } else if (action == MotionEvent.ACTION_UP
                    || action == MotionEvent.ACTION_CANCEL) {
                setParentInterception(view, false);
            }
            // Do not consume the gesture; the WebView owns normal scrolling.
            return false;
        });

        // Keep the helper explicit so a missing parent can never swallow or
        // crash an otherwise valid WebView gesture.
        setParentInterception(webView, false);

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

    private void setParentInterception(View view, boolean disallow) {
        if (view.getParent() != null) {
            view.getParent().requestDisallowInterceptTouchEvent(disallow);
        }
    }

    private void syncActiveScrollPosition(MotionEvent event) {
        float density = getResources().getDisplayMetrics().density;
        float cssX = event.getX() / density;
        float cssY = event.getY() / density;
        String script = String.format(Locale.US,
                "(function(x,y){" +
                        "var n=document.elementFromPoint(x,y);" +
                        "while(n&&n!==document.body){" +
                        "var s=getComputedStyle(n);" +
                        "if((s.overflowY==='auto'||s.overflowY==='scroll')&&n.scrollHeight>n.clientHeight+1)" +
                        "return n.scrollTop<=1;" +
                        "n=n.parentElement;" +
                        "}" +
                        "var r=document.scrollingElement||document.documentElement;" +
                        "return r.scrollTop<=1;" +
                        "})(%.2f,%.2f);",
                cssX,
                cssY
        );
        webView.evaluateJavascript(script, value -> refreshLayout.setContentAtTop("true".equals(value)));
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