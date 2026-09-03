---
name: Authenticated performance profiling
description: Constraint for collecting trustworthy mobile performance measurements in this project.
---

Authenticated browser profiling requires a user-provided Playwright storage-state file containing a valid session. The development preview may start at the login screen with no session, and the profiler must stop rather than substitute guest traffic.

**Why:** On September 3, 2026 the preview had no authenticated session or test credentials, so request, realtime, CPU, and media numbers from that page would not represent the authenticated screens.

**How to apply:** Run the same mobile navigation script twice with the same storage state, once labeled before and once labeled after. Treat missing state, visible login, missing required controls, and incomplete stages as blocked profiles, not zero measurements.