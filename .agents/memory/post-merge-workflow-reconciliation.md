---
name: Post-merge workflow reconciliation
description: Post-merge setup can succeed while Replit workflow reconciliation fails on a missing injected skill path.
---

The post-merge hook is independently verifiable even when workflow reconciliation reports a missing `.local/skills/image-search` path.

**Why:** The injected skill directory can exist in the workspace while the platform reconciliation process resolves a different filesystem view, so changing application workflows or code does not repair the error.

**How to apply:** Verify the configured post-merge script and run it directly through the platform first. If the script succeeds and reconciliation still fails on that path, report the platform error rather than changing workflow commands or application code.