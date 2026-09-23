---
name: Settings editor safety
description: Durable interaction rule for admin showcase editing in Settings
---

Admin showcase editing must keep its typed draft in the editor component, not in a parent that may re-fetch or switch views. The edit surface must not dismiss on backdrop clicks; only explicit Cancel, X, or successful Save may close it.

**Why:** Unsaved admin inputs were being lost when clicks bubbled into surrounding settings behavior or when the parent view re-rendered.

**How to apply:** Keep fields controlled by local state initialized once per add/edit session, stop event propagation inside the editor, and use a visual-only backdrop without a click-to-close handler.