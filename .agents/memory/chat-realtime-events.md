---
name: Chat realtime event coverage
description: Rules for keeping one-to-one chat messages and reactions synchronized across both participants.
---

Use an unfiltered conversation channel for messages and filter by both participant IDs in the client; a receiver-only Realtime filter misses sender-side edits and deletes. Track reaction row metadata locally because DELETE payloads may contain only the primary-key ID, then patch the reaction map for INSERT, UPDATE, and DELETE events.

**Why:** One participant must see the other participant’s edits, reactions, and “Delete for Everyone” immediately, while Supabase may omit non-key columns from DELETE payloads under the default replica identity.

**How to apply:** Keep the channel scoped to the active conversation in callback logic, clear subscriptions when the chat changes or the document is hidden, and retain a row-ID-to-reaction lookup for reliable reaction deletion.