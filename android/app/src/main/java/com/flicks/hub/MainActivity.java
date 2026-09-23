package com.flicks.hub;

import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private AndroidShareBridge shareBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            shareBridge = new AndroidShareBridge(this);
            webView.addJavascriptInterface(shareBridge, "AndroidShare");
            // Let the React pull-to-refresh surface own the downward edge
            // gesture instead of Android's overscroll glow/nested scrolling.
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webView.setNestedScrollingEnabled(false);
            webView.setOnTouchListener((view, event) -> {
                final int action = event.getActionMasked();
                if (action == MotionEvent.ACTION_DOWN) {
                    view.getParent().requestDisallowInterceptTouchEvent(true);
                } else if (action == MotionEvent.ACTION_UP
                        || action == MotionEvent.ACTION_CANCEL) {
                    view.getParent().requestDisallowInterceptTouchEvent(false);
                }
                return false;
            });
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
}
