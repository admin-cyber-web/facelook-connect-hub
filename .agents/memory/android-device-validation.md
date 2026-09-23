---
name: Android device validation prerequisites
description: Native Capacitor validation needs an Android SDK and Java 21 in the workspace.
---

The workspace can run the Capacitor Gradle wrapper but cannot assemble or launch the Android app unless an Android SDK is installed and Java 21 is available.

**Why:** The wrapper requires Java 21 and Android build tooling; this environment currently exposes Java 17 and no Android SDK, so browser or jsdom checks cannot substitute for a device run.

**How to apply:** Before claiming Android hardware/emulator validation, check `adb`, the Android SDK, and the Gradle JVM requirement. If unavailable, run the component-level touch contract and queue a device follow-up instead of claiming native confirmation.