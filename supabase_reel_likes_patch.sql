-- Focused Reel-like integrity patch.
--
-- FameFeed Reels are video rows in public.posts, so their per-user likes use
-- the existing public.likes source table. This constraint makes the Reel
-- upsert idempotent and prevents one user from creating duplicate likes for
-- the same Reel. It does not update posts.likes_count or change the normal
-- post-like UI path.
--
-- Run this focused patch against an existing Supabase database. It will fail
-- explicitly if duplicate likes already exist, so those rows can be reviewed
-- before any data cleanup is performed.
create unique index if not exists likes_post_id_user_id_key
  on public.likes (post_id, user_id);