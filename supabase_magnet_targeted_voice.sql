-- ═══════════════════════════════════════════════════════════════
--  MAGNET SYSTEM — targeted private voice migration
--  Run once in the Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Add target_user_id column to post_magnet_voice
--    NULL  → public voice visible to everyone in the chain
--    UUID  → private voice visible ONLY to that specific user
ALTER TABLE post_magnet_voice
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Index for fast per-user targeted lookups
CREATE INDEX IF NOT EXISTS magnet_voice_target_idx
  ON post_magnet_voice(post_id, post_type, target_user_id);

-- 3. Drop the old over-restrictive unique that only allowed one row per post.
--    The code already inserts one row per owner; we now also allow one row per
--    (owner × target) pair.
ALTER TABLE post_magnet_voice
  DROP CONSTRAINT IF EXISTS post_magnet_voice_post_id_post_type_key;

-- 4. New unique: one public voice per owner per post,
--               one private voice per (owner, target) per post.
--    We use COALESCE to treat NULL target as a stable sentinel value.
ALTER TABLE post_magnet_voice
  ADD CONSTRAINT post_magnet_voice_owner_target_unique
  UNIQUE (post_id, post_type, owner_id, target_user_id);

-- 5. Re-enable realtime (safe to run again)
ALTER PUBLICATION supabase_realtime ADD TABLE post_magnet_voice;
