---
name: Step 2 aggregate egress
description: Deployment contract for bounded aggregate reads used by feed, survey, page, and circle surfaces
---

Prefer server-side aggregate RPCs for totals and viewer reaction state, passing only the currently visible or paged IDs. Keep a bounded client fallback until the SQL patch is applied in every environment.

**Why:** Raw child-row downloads grow with engagement rather than with the visible page, and a client rollout can precede the database function rollout.

**How to apply:** When adding a new aggregate RPC, update the focused SQL patch and client together, preserve a page-scoped fallback, and verify the RPC role grants before removing the fallback.