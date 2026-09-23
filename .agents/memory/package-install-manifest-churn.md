---
name: Package install manifest churn
description: Workspace Node dependency provisioning can rewrite unrelated package pins and lockfile sources.
---

When provisioning missing Node dependencies in an existing project, inspect package.json and package-lock.json afterward and revert unrelated version or registry changes before delivery.

**Why:** The workspace package installer can resolve the full manifest to newer versions while installing missing modules, even when the task only needs local verification. Committing that churn expands the change surface and may alter unrelated runtime behavior.

**How to apply:** Keep the installed modules for local checks if useful, but restore unrelated manifest/lockfile edits and verify only the intended source files remain changed.