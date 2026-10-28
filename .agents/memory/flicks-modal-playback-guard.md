---
name: Flicks modal playback guard
description: Keep document-level reel playback recovery out of modal interactions on Android.
---

When a full-screen modal is open over Flicks, document-capture playback recovery must ignore gestures from the modal. Avoid expensive full-viewport backdrop blur over active reel video on Android.

**Why:** Flicks retries paused video on document-level touch, click, scroll, and wheel events. A modal can pause the obscured reel, then its own gestures can repeatedly trigger playback retries behind the overlay; full-screen video blur also increases mobile compositing cost.

**How to apply:** Mark modal roots with an explicit no-media-retry attribute and accessible dialog semantics, guard capture listeners against modal-originated gestures, and use a solid/dimmed backdrop instead of blurring a live video.
