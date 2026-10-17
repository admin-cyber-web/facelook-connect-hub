---
name: Profile comment actions
description: Direct event handling and database authorization for profile timeline comment edit and delete controls.
---

Use direct button handlers for profile comment actions instead of routing through submenu-dependent event delegation. Edit opens the inline editor, Save invokes the edit callback with the edited content, and Delete invokes the delete callback with the post and comment IDs. Let the Supabase query's user-ID filter enforce authorization rather than rejecting from a cached comment author ID.

**Why:** the user reported that the delegated/menu-based actions remained ineffective and explicitly requested direct handlers with database-side user filtering.

**How to apply:** when changing profile timeline comments, keep Edit/Save/Delete controls directly wired to their handlers and preserve optimistic updates with rollback on database errors.
