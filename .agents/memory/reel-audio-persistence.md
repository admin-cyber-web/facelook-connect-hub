---
name: Reel audio persistence
description: Canonical database field and compatibility fallback for Reel background music.
---

Use `public.posts.audio_url` as the canonical Reel background-music field. Keep the selected URL in `metadata.audio_url` as a compatibility fallback; read legacy `music_track_url` values where available, but do not add a second database column just for that alias.

**Why:** The existing Reel migration already defines `posts.audio_url`. Writing both the dedicated column and metadata supports direct feed queries while retaining compatibility with older rows and deployments that have not applied the optional column migration. Partial update events can omit the column, so cache merges must explicitly normalize it or a stale cached value can override fresh metadata.

**How to apply:** Reel create/update flows should write `audio_url` and `metadata.audio_url`. Feed reads should prefer the column, then fall back to metadata. Normalize `audio_url` from the resolved Reel settings when applying update events. Preserve legacy `music_track_url` reading unless the persistence contract is intentionally migrated.