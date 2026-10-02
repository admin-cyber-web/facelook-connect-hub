---
name: Vibe audio playback policy
description: User-visible autoplay, browser-block recovery, and mute/handoff behavior for cinematic vibe audio.
---

Vibe audio is opt-out: a visible vibe post should attempt unmuted playback by default at the HTML audio element's maximum volume. If browser policy blocks it, keep the attempt quiet and retry synchronously from a user gesture; do not show a “Could not play this vibe audio” error. A single shared player follows the most-visible post, and explicit mute persists across post handoffs. Respect browser autoplay restrictions rather than bypassing them with muted playback.

**Why:** The user asked for unmuted audio by default at full element volume, a manual mute control, and gesture-based recovery when a browser blocks autoplay.

**How to apply:** Changes to vibe-audio state, feed visibility handoffs, or the audio toggle should preserve these expectations on desktop and mobile. Device and browser output limits still apply.