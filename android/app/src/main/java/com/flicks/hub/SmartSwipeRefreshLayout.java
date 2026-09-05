package com.flicks.hub;

import android.content.Context;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

/**
 * Lets the WebView own normal vertical scrolling. SwipeRefreshLayout is only
 * allowed to intercept an intentional downward pull that starts at the top of
 * the active web scroll surface.
 */
public class SmartSwipeRefreshLayout extends SwipeRefreshLayout {

    private final int touchSlop;
    private WebView contentWebView;
    // Never let the native wrapper participate in the first WebView gesture.
    // The web bridge must explicitly opt in after the page is ready.
    private boolean nativeSwipeEnabled = false;
    private boolean contentAtTop = true;
    private float downX;
    private float downY;

    public SmartSwipeRefreshLayout(@NonNull Context context) {
        this(context, null);
    }

    public SmartSwipeRefreshLayout(@NonNull Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
        touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
        setEnabled(true);
    }

    public void setContentWebView(@Nullable WebView webView) {
        contentWebView = webView;
    }

    public void setSwipeEnabled(boolean enabled) {
        nativeSwipeEnabled = enabled;
        if (!enabled) {
            setRefreshing(false);
        }
        invalidate();
    }

    public boolean isSwipeEnabled() {
        return nativeSwipeEnabled;
    }

    public void setContentAtTop(boolean atTop) {
        contentAtTop = atTop;
    }

    public boolean isContentAtTop() {
        return contentAtTop;
    }

    @Override
    public boolean onInterceptTouchEvent(MotionEvent event) {
        // Pull-to-refresh is handled by the web app. Never let this parent
        // intercept or cancel a WebView gesture.
        return false;
    }

    @Override
    public boolean onStartNestedScroll(
            @NonNull View child,
            @NonNull View target,
            int axes
    ) {
        return false;
    }

    @Override
    public boolean canChildScrollUp() {
        return true;
    }
}