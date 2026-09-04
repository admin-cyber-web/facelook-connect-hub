---
name: Android WebView verification
description: Environment limits for validating Capacitor Android touch behavior
---

Physical Android WebView gestures cannot be exercised in this workspace because neither `adb` nor an Android emulator is available. Browser preview screenshots and source/build checks can verify the web-side scroll contracts, but they cannot confirm device-specific rubber-banding or WebView pull-to-refresh behavior.

**Why:** The scrolling task requires a real Capacitor WebView swipe, while this environment only provides the web preview and an Android project without a connected runtime.

**How to apply:** Report device verification as deferred when `adb devices` and emulator discovery are unavailable; do not claim a real Android swipe passed based only on desktop or browser emulation.