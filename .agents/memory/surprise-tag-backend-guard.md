---
name: Surprise tag trigger behavior
description: Backend validation rules for the one-time friend-only surprise reaction payload
---

The surprise-tag trigger must validate friendship when a surprise target or post author is introduced or changed, but allow the recipient-scoped `isSeen` update to complete even if the friendship changes later. PostgreSQL trigger operation names are uppercase (`INSERT` and `UPDATE`).

**Why:** marking a surprise as seen updates `posts.metadata` after posting; rechecking friendship on every metadata update can block the legitimate one-time reveal after an author and recipient unfriend.

**How to apply:** keep target validation in the trigger and recipient authorization/once-only semantics in the `mark_surprise_message_seen` security-definer RPC. Preserve the exact JSON payload fields when adding or changing a tag.