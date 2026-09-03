---
name: Supabase bandwidth guardrails
description: Durable rules for keeping Flicks realtime and database traffic bounded.
---

Public collection views should use bounded, explicit-column fetches and manual refresh or mount-time loading rather than global realtime refreshes. Realtime is reserved for user-, conversation-, room-, post-, circle-, or page-scoped state and must disconnect while the document is hidden.

**Why:** Global table listeners and timer-driven refetches create egress that scales with unrelated users' activity, especially on feed, story, admin, and reaction tables.

**How to apply:** For new Supabase reads, avoid select("*"), add a list limit, debounce search input, and ensure every channel is cleaned up through a returned effect cleanup or the visibility-aware subscription helper.

Each user-scoped Realtime table/filter pair should have one channel owner that fans updates into alerts, badges, and active views instead of opening overlapping listeners.

**Why:** Multiple listeners for the same row stream multiply websocket delivery and make visibility resume prone to duplicate updates and redundant fetches.

**How to apply:** Before adding a listener, search for the table/filter already in use; extend the existing owner or use a local browser event for sibling components that need the same update.