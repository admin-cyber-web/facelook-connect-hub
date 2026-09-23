---
name: Android icon generation
description: ImageMagick behavior and resource expectations for regenerating the Capacitor launcher icon set
---

Use separate mask images when creating circular Android launcher icons with the installed ImageMagick build; nested clone/composite expressions can fail with “image sequence is required”.

**Why:** The project uses density-specific regular, round, and adaptive foreground PNGs, and the local ImageMagick CLI is strict about the image sequence passed to `-composite`.

**How to apply:** Generate the density PNG first, create a same-size transparent/white circular mask, then apply it with `CopyOpacity`; keep the adaptive background color resource alongside the `mipmap-anydpi-v26` XML.