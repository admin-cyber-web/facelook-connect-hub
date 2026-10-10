---
name: Dynamic social previews
description: Crawler-facing Open Graph metadata for shared posts, reels, and Flicks Frame requests.
---

Social crawlers often do not execute the React application, so dynamic post and Frame previews must be served as HTML by the edge middleware, not only through client-side Helmet tags. Cover both `/post/:id` and query-based `/?frame=...` share URLs.

Use the real image, video cover, or request photo as the preview. Reserve the promotional app image for items that genuinely have no media.

**Why:** The SPA's static HTML otherwise gives every shared item the same default image, and crawler caches do not rely on browser-side metadata updates.

**How to apply:** When adding a share URL shape, make sure the crawler middleware matches it and can resolve that item through the existing public API before falling back to the app's static tags.
