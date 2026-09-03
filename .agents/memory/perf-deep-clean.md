---
name: Mobile Performance Deep Clean
description: Audit + fixes applied to stop CPU/GPU heating on mobile. Key patterns and rules for future features.
---

## Rules

**Why:** Mobile heating traced to Supabase channel leaks, infinite JS animations, console.log object serialization, and unbounded DOM.

**How to apply:** Every new feature that adds to a feed, chat, or realtime subscription must follow these patterns.

### 1. Supabase channels — gate on visibility
Never open a Supabase realtime channel at mount time for list-rendered components (e.g. MagnetSystem on feed cards). Open channels only when user actively opens a panel/modal. Gate with a `channelsActive` prop or similar.

### 2. Infinite animations — CSS only, not Framer Motion
`repeat: Infinity` in Framer Motion runs on JS main thread. Replace with `@keyframes` in CSS (GPU compositor thread). Pattern: add keyframe to `src/index.css`, apply via `style={{ animation: "name Xs ease-in-out infinite" }}`.

### 3. console.log in hot paths = real CPU cost
V8 serializes every logged object. Remove all debug logs from onChange handlers, send handlers, subscription callbacks, map() renders.

### 4. FlicksFeed DOM virtualization
Only mount `<FlickCard>` for `Math.abs(i - currentIndex) <= 2`. All other indices get a `<div className="... snap-start" style={{ height: "100dvh" }} />`. Preserves snap scroll perfectly.

### 5. RAF-throttle all onScroll handlers
Use `requestAnimationFrame` + `scrollTicking` ref pattern — fires at most once per frame. See FlicksFeed.tsx.

### 6. img decoding + video preload
All `<img>` → `decoding="async"`. Non-autoPlay `<video>` → `preload="none"`. Skip autoPlay videos.

### 7. Background timer guards
Any `setInterval` updating UI must check `document.hidden` first (see StoryBar.tsx).

### 8. Global listeners — all have cleanup
All addEventListener in codebase have matching removeEventListener. No leaks as of this pass.

### 9. React.lazy — already applied everywhere in Index.tsx
### 10. ChatSystem search — already has built-in debounce via searchDebounceRef setTimeout

### 11. Shared caches — bounded and request-deduplicated
Custom in-memory caches must have both a maximum entry count and a maximum list payload size. Expired entries should be pruned opportunistically, without a cleanup interval, and concurrent cache misses for the same key should share one request.

**Why:** A five-minute TTL alone does not bound memory or Supabase traffic: remounts can create duplicate requests, and long sessions can retain large feed arrays indefinitely.

**How to apply:** Keep cache data process-local, clear it on logout, protect it from repopulation by pre-logout requests, and cap persisted ID lists as well as in-memory feed data.

### 12. Engagement counters — source rows first
For per-user likes and comments, mutate the source rows only: serialize same-item UI mutations, rely on unique constraints/RLS, and maintain denormalized counters with database triggers rather than client-calculated increments.

**Why:** Rapid taps and concurrent users can otherwise overwrite counters derived from stale card state, even when the visible UI appears optimistic and correct.

**How to apply:** Read a bounded exact count only to reconcile local UI after a successful mutation; never write that client-side count back over the authoritative trigger-managed counter.

### 13. Share optional hardware resources
Reuse one feedback `AudioContext` across short UI sounds and suspend it after an idle grace period. Stop camera tracks and pause media when `document.hidden` is true; only resume when the owning feature is still active.

**Why:** Mobile browsers may keep audio, camera, and video decoder resources alive even when a tab or WebView is backgrounded, increasing battery drain and thermal load.

**How to apply:** Every camera, story viewer, autoplay video, or Web Audio feature needs explicit visibility cleanup and must tolerate play/resume rejection.

### 14. Bound every on-demand projection
Use explicit columns and a finite row limit for comments, admin queues, room members, and joined profile projections. Avoid wildcard selects, especially when nested profile joins are present.

**Why:** Detail panels and moderation screens are user-triggered but can still pull unbounded historical rows or unused media metadata into mobile clients.

**How to apply:** Treat every `.select()` in a list/detail fetch as a reviewed payload contract, and add cancellation or request-identity guards where selection can change.
