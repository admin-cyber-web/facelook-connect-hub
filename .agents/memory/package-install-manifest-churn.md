---
name: Package install manifest churn
description: Workspace Node dependency provisioning can rewrite unrelated package pins and lockfile sources.
---

When provisioning missing Node dependencies in an existing project, inspect package.json and package-lock.json afterward and revert unrelated version or registry changes before delivery.

Reinstalling an already-declared package at its exact version can still rewrite that package's lockfile tarball URL back to Replit's internal registry; verify the final `resolved` URLs after installing.

**Why:** The workspace package installer can resolve the full manifest to newer versions while installing missing modules, even when the task only needs local verification. It can also reintroduce internal registry URLs that break external builds. Committing that churn expands the change surface and may alter unrelated runtime behavior.

**How to apply:** Keep the installed modules for local checks if useful, but restore unrelated manifest/lockfile edits and verify only the intended source files remain changed.