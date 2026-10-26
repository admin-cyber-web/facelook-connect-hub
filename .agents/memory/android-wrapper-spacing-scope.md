---
name: Android wrapper spacing scope
description: Scope viewport and system-bar spacing fixes to the Capacitor Android wrapper when browser layouts are already correct.
---

When a viewport-spacing issue is reported as specific to the Capacitor Android app while the mobile-browser version works, remove or correct the Android-only injected offsets and status-bar overrides first. Do not change the normal browser layout to compensate for a native-only problem.

**Why:** The user clarified that Flicks works correctly in mobile browsers and that the blank space occurs only in the Android Capacitor wrapper.

**How to apply:** Check platform class injection, native window/system-bar settings, forced safe-area minimums, and root viewport padding before changing shared mobile layout behavior.
