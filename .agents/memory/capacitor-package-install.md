---
name: Capacitor package installs
description: Workspace-specific dependency installation behavior for Capacitor native plugins
---

When adding Capacitor plugins, use the supported package-management flow. If it fails before dependency resolution because the bundled npm runtime is inconsistent or blocked by the package firewall, repair that npm runtime through the same supported flow before retrying the plugin install.

**Why:** This workspace can have a lockfile-resolved npm version whose package files are not the active local npm bundle, causing plugin installs to fail with misleading missing-module errors.

**How to apply:** Treat package-manager repair as environment setup only; keep the application diff limited to the requested plugin manifests and source changes.