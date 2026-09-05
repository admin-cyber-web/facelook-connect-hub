package com.flicks.hub;

import android.annotation.SuppressLint;
import android.os.Bundle;
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

}
