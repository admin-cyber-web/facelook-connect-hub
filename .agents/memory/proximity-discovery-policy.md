---
name: Proximity discovery policy
description: Product rules for the Flicks proximity discovery platform and Stealth behavior.
---

Proximity discovery is Android-only. Stealth is mute-only: local discovery remains active while alert sound, vibration, and the visual proximity alert are suppressed.

**Why:** The user selected Android-only BLE support and chose mute-only Stealth so they remain discoverable while silencing alerts.

**How to apply:** Keep the local scanner active when Stealth is enabled. Do not interpret Stealth as hiding or stopping profile broadcast; profile visibility remains controlled by the app's privacy settings.
