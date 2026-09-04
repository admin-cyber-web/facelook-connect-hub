---
name: Post-merge npm dependency
description: Avoiding clean-install failures caused by declaring the npm CLI as a project dependency.
---

The npm CLI should remain the workspace/toolchain package, not an application dependency in `package.json`.

**Why:** Replit post-merge setup runs a clean install through the package firewall. A direct npm dependency makes npm fetch a nested npm CLI tarball, which can be rejected even when normal local builds work.

**How to apply:** Before adding or restoring an `npm` manifest dependency, confirm the application imports it. Keep package-manager tooling in the configured Node.js module and keep post-merge setup on a deterministic `npm ci --ignore-scripts` path.