---
name: Global interaction isolation layers
description: Avoid false full-screen modal detection from decorative backgrounds.
---

**Rule:** In this app, do not use full-viewport `position: fixed` elements for decorative backgrounds unless they are explicitly excluded from global interaction isolation. `pointer-events: none` alone does not exclude them; prefer a page-bound absolute background.

**Why:** Global interaction isolation treats visible fixed elements covering most of the viewport as active surfaces. It can inert their siblings and lock document scrolling even when the element is only decorative.

**How to apply:** When a page appears unresponsive after navigation, inspect full-screen fixed layers as well as dialogs. Keep decorative backgrounds out of the active-surface detector and ensure they cannot cover the page’s controls.
