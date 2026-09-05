package com.flicks.hub;

import android.content.Context;
import android.util.AttributeSet;
import android.view.MotionEvent;
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
    private boolean nativeSwipeEnabled = true;
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
        if (!nativeSwipeEnabled) {
            return false;
        }

        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                downX = event.getX();
                downY = event.getY();
                super.onInterceptTouchEvent(event);
                return false;

            case MotionEvent.ACTION_MOVE:
                float deltaX = event.getX() - downX;
                float deltaY = event.getY() - downY;

                // Do not steal horizontal gestures or tiny finger movement.
                if (Math.abs(deltaX) > Math.abs(deltaY)
                        || Math.abs(deltaY) < touchSlop) {
                    return false;
                }

                // Upward movement, or a downward movement away from the true
                // top, belongs entirely to the WebView.
                if (deltaY <= 0 || !contentAtTop || canChildScrollUp()) {
                    return false;
                }

                // Only now may SwipeRefreshLayout take over the gesture.
                return super.onInterceptTouchEvent(event);

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                downX = 0f;
                downY = 0f;
                return false;

            default:
                return false;
        }
    }

    @Override
    public boolean canChildScrollUp() {
        if (!nativeSwipeEnabled || !contentAtTop) {
            return true;
        }

        if (contentWebView != null && contentWebView.canScrollVertically(-1)) {
            return true;
        }

        return super.canChildScrollUp();
    }
}