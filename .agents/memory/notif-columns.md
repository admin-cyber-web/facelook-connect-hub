---
name: Notifications DB column naming
description: The notifications table uses notifier_id (recipient) and actor_id (sender) — NOT user_id.
---

## Rule
The `notifications` table columns are:
- `notifier_id` — the user who RECEIVES the notification (was incorrectly coded as `user_id` in sendNotification for months)
- `actor_id` — the user who TRIGGERED the notification (the sender/actor)
- `entity_id` — the post/entity ID so handleNotifClick can scroll to it

## Why
All magnet notifications were silently failing because `sendNotification` was inserting `{ user_id: ... }` but the DB column is `notifier_id`. No error was thrown (Supabase ignores unknown columns in insert by default), so the bug was invisible.

## How to apply
Any new notification insert must use `notifier_id`, never `user_id`. The corrected `sendNotification` signature:
```typescript
async function sendNotification(notifierId, content, type, actorId?, entityId?)
```
Always pass `entityId = postId` so the bell-click can navigate to the post.
