---
name: Private chat search guard
description: Privacy rules for private-profile discovery and direct messaging
---

Private-profile search and chat access must use a server-side security-definer check for an accepted direct friend or accepted mutual connection. Client-only filtering is not enough because normal friendship RLS cannot inspect the candidate's other connections.

**Why:** a profile can be hidden from the UI yet still be fetched or targeted directly unless the search boundary and message insert policy enforce the same relationship rule.

**How to apply:** use the privacy-aware profile search RPC exclusively for discovery, fail closed with no results if it is unavailable, and keep a matching message RLS guard for private recipients. In this project the privacy column is `is_private_mode`.