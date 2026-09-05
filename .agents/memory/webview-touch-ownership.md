---
name: WebView touch ownership
description: Durable rules for preventing Android WebView gestures from being swallowed by CSS or native refresh containers.
---

Normal taps, scrolling, carousels, and feed gestures belong to the WebView. Native pull-to-refresh must be disabled by default and opt in only after an explicit top-of-active-surface downward gesture is confirmed.

**Why:** A full-screen native refresh parent or restrictive CSS touch-action can create a deadlock where only a separate control layer remains interactive.

**How to apply:** Keep app/root and interactive surfaces pointer-enabled, use the browser default touch-action unless a gesture-specific surface truly needs a restriction, and gate SwipeRefreshLayout interception plus nested scrolling behind the explicit native opt-in.