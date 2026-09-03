---
name: Chat async lifecycle
description: Durable rules for keeping chat rendering and Supabase callbacks safe during navigation and partial data failures.
---

Normalize every message, profile, story, and realtime payload at the boundary before rendering or comparing identifiers. Database and realtime rows can contain null fields even when the TypeScript model marks them as required.

**Why:** A fallback conversation query once called `.trim()` directly on nullable sender/receiver IDs, turning a recoverable Supabase response into a production render crash.

**How to apply:** Keep mounted/request-identity guards around debounced searches, message loads, realtime callbacks, story/media actions, and async UI actions. Catch both Supabase errors and rejected helper promises; never leave fire-and-forget chat work without an explicit rejection handler.

The parent boundary around the lazy ChatSystem must not automatically close the chat state when a render/import error occurs. Keep the failure visible and reset the boundary when the user closes/reopens chat.

**Why:** Automatically setting the open state to false made a failed lazy mount look like a dead header button and left the boundary in its failed state for the next click.

**How to apply:** Use an open/closed reset key and a visible retry/close fallback around ChatSystem; keep the header trigger as a direct state transition.