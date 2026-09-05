package com.flicks.hub;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private SmartSwipeRefreshLayout refreshLayout;
    private WebView webView;
    private float touchDownY;
    private final int touchSlop = 8;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureNativeScrolling();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureNativeScrolling() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        webView = getBridge().getWebView();
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setNestedScrollingEnabled(true);
        webView.setVerticalScrollBarEnabled(false);
        webView.addJavascriptInterface(
                new ScrollControlBridge(new ScrollControlBridge.Listener() {
                    @Override
                    public void onSwipeEnabledChanged(boolean enabled) {
                        runOnUiThread(() -> {
                            if (refreshLayout != null) {
                                refreshLayout.setSwipeEnabled(enabled);
                            }
                        });
                    }

                    @Override
                    public void onContentAtTopChanged(boolean atTop) {
                        runOnUiThread(() -> {
                            if (refreshLayout != null) {
                                refreshLayout.setContentAtTop(atTop);
                            }
                        });
                    }
                }),
                "ScrollControl"
        );

        wrapBridgeWebView();
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
                        && refreshLayout != null
                        && refreshLayout.isSwipeEnabled()
                        && refreshLayout.isContentAtTop()
                        && !webView.canScrollVertically(-1);
                setParentInterception(view, !allowNativePull);
            } else if (action == MotionEvent.ACTION_UP
                    || action == MotionEvent.ACTION_CANCEL) {
                setParentInterception(view, false);
            }
            // Never consume the event; WebView must receive the full gesture.
            return false;
        });
    }

    private void setParentInterception(View view, boolean disallow) {
        if (view.getParent() != null) {
            view.getParent().requestDisallowInterceptTouchEvent(disallow);
        }
    }

    private void wrapBridgeWebView() {
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (parent == null || parent instanceof SmartSwipeRefreshLayout) {
            return;
        }

        int childIndex = parent.indexOfChild(webView);
        ViewGroup.LayoutParams parentParams = webView.getLayoutParams();
        parent.removeView(webView);

        refreshLayout = new SmartSwipeRefreshLayout(this);
        refreshLayout.setLayoutParams(parentParams);
        refreshLayout.setContentWebView(webView);
        refreshLayout.setOnRefreshListener(() -> {
            webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('flicks-pull-refresh'));",
                    ignored -> refreshLayout.postDelayed(
                            () -> refreshLayout.setRefreshing(false),
                            700
                    )
            );
        });
        refreshLayout.addView(webView, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        parent.addView(refreshLayout, childIndex, parentParams);
    }

    private void syncActiveScrollPosition(MotionEvent event) {
        if (refreshLayout == null || webView == null) {
            return;
        }

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
        webView.evaluateJavascript(script, value -> {
            if (refreshLayout != null) {
                refreshLayout.setContentAtTop("true".equals(value));
            }
        });
    }
}
