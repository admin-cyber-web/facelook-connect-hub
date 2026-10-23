---
name: Report modal pointer lifecycle
description: Prevent menu-launched report dialogs from dismissing on the same pointer gesture.
---

Open a modal from a menu item's `click`, not its `pointerdown`. A modal rendered on `pointerdown` can mount its backdrop before the pointer is released, so the original gesture may hit the new backdrop and dismiss the dialog. Keep portaled backdrops and dialog containers explicitly interactive, and give reason buttons pointer cursors and click handlers.

**Why:** A menu-triggered report modal was appearing unresponsive because its backdrop could intercept the pointer gesture that opened it.

**How to apply:** When an action replaces a menu with a modal, defer opening until the click event; keep the backdrop, modal, and child controls at explicit z-index and pointer-event layers.
