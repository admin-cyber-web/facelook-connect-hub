---
name: Native package declarations
description: Why Capacitor plugins used by web bundles must be declared explicitly
---

Capacitor plugins imported by application code must be direct dependencies in both `package.json` and the lockfile, even when they already exist in local `node_modules`.

**Why:** Local plugin folders can be extraneous leftovers from a prior install, while Vercel and other publish providers resolve from a clean dependency tree and fail on undeclared imports.

**How to apply:** When adding a Capacitor plugin import, verify `npm ls` has no extraneous result and validate with a clean-install dry run before publishing.