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
