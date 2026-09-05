---
name: WebView touch ownership
description: Durable rules for preventing Android WebView gestures from being swallowed by CSS or native refresh containers.
---

Normal taps, scrolling, carousels, and feed gestures belong to the WebView. Pull-to-refresh is recognized in the web layer only after an explicit top-of-active-surface downward gesture; the Android refresh parent must never intercept the WebView stream.

**Why:** A full-screen native refresh parent or restrictive CSS touch-action can create a deadlock where only a separate control layer remains interactive.

**How to apply:** Keep app/root and interactive surfaces pointer-enabled, use the browser default touch-action unless a gesture-specific surface truly needs a restriction, and keep SwipeRefreshLayout interception/nested scrolling disabled. Dispatch the existing pull-refresh event from the web gesture handler, except while chat owns the gesture.