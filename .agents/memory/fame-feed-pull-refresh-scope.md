---
name: Fame Feed pull-to-refresh scope
description: Keep Android pull-to-refresh behavior exclusive to the Fame Feed route and interaction state.
---

Fame Feed pull-to-refresh is permitted only on `/` and `/feed` while the Fame feature is active and blocking overlays are closed. Flicks/Reels, Chat, and every other route or screen must retain their normal touch and scroll behavior.

**Why:** The user explicitly repeated this route boundary after refresh gestures conflicted with other app screens.

**How to apply:** Any future pull-to-refresh, native overscroll, or touch-listener changes must preserve this route-and-state gate and verify that the handler calls the Fame Feed data loader.
