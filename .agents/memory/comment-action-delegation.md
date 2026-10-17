---
name: Comment action delegation
description: Reliable event handling for dynamically rendered profile timeline comment edit and delete controls.
---

Handle dynamic profile comment actions with event delegation on the comments container. Keep the edit/delete action controls in that container's event-bubbling path and read `postId` and `commentId` from the clicked control's dataset before calling the mutation handlers.

**Why:** the user reiterated that earlier edits did not make the comment buttons work and asked for a fix based on delegation rather than inline handlers.

**How to apply:** when changing profile timeline comments, trace the rendered action menu and its DOM/event path; verify the delegated click calls the existing edit/delete callback with both IDs and that the mutation updates local state.
