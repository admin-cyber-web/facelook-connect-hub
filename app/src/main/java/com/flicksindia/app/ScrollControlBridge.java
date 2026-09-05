package com.flicksindia.app;

import android.webkit.JavascriptInterface;

public class ScrollControlBridge {

    public interface Listener {
        void onSwipeEnabledChanged(boolean enabled);
        void onContentAtTopChanged(boolean atTop);
    }

    private final Listener listener;

    public ScrollControlBridge(Listener listener) {
        this.listener = listener;
    }

    @JavascriptInterface
    public void setSwipeEnabled(boolean enabled) {
        listener.onSwipeEnabledChanged(enabled);
    }

    @JavascriptInterface
    public void setContentAtTop(boolean atTop) {
        listener.onContentAtTopChanged(atTop);
    }
}