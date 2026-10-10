---
name: Dynamic social previews
description: Crawler-facing Open Graph metadata for shared posts, reels, and Flicks Frame requests.
---

Social crawlers often do not execute the React application, so dynamic post and Frame previews must be served as raw HTML, not only through client-side Helmet tags. Replit Autoscale runs Vite Preview rather than Vercel middleware, so crawler handling must be connected to the actual deployment runtime too. Cover both `/post/:id` and query-based `/?frame=...` share URLs.

Use the real image, video cover, or request photo as the preview. Reserve the promotional app image for items that genuinely have no media.

**Why:** The SPA's static HTML otherwise gives every shared item the same default image, crawler caches do not rely on browser-side metadata updates, and platform middleware does not run on a different hosting runtime.

**How to apply:** When adding a share URL shape, make sure the crawler handler runs in the active deployment server and resolves the item through the existing public API. Keep the promotional image only for content that has no media.
