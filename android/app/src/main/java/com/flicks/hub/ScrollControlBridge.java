package com.flicks.hub;

import android.webkit.JavascriptInterface;

/**
 * Small bridge used by the web app to temporarily opt out of native
 * pull-to-refresh while a full-screen interaction, such as chat, owns touch.
 */
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