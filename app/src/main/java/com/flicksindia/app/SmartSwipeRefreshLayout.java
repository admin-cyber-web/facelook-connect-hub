package com.flicksindia.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.ViewConfiguration;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

/**
 * Keeps regular WebView scrolling untouched and only hands a gesture to the
 * native refresh container when it is a deliberate downward pull from the
 * active web scroll surface's true top.
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

                if (Math.abs(deltaX) > Math.abs(deltaY)
                        || Math.abs(deltaY) < touchSlop) {
                    return false;
                }

                if (deltaY <= 0 || !contentAtTop || canChildScrollUp()) {
                    return false;
                }

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