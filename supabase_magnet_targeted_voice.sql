-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Magnet Targeted Voice (Private Messages)
-- Run once in your Supabase SQL Editor (safe to re-run — uses IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add target_user_id column to post_magnet_voice
ALTER TABLE post_magnet_voice
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Drop old unique constraint (public voice per post, before targeted messages)
ALTER TABLE post_magnet_voice
  DROP CONSTRAINT IF EXISTS post_magnet_voice_post_id_post_type_key;

-- 3. New constraint: one row per (post, owner, target).
--    NULLS NOT DISTINCT means two NULLs in target_user_id ARE considered equal
--    → only one public voice per owner per post, but unlimited private ones.
--    Requires PostgreSQL 15 (Supabase default). Fallback below if needed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_magnet_voice_unique_target'
  ) THEN
    ALTER TABLE post_magnet_voice
      ADD CONSTRAINT post_magnet_voice_unique_target
      UNIQUE NULLS NOT DISTINCT (post_id, post_type, owner_id, target_user_id);
  END IF;
END $$;

-- 4. Index for fast targeted-message lookups in feed
CREATE INDEX IF NOT EXISTS idx_pmv_target_lookup
  ON post_magnet_voice(post_id, post_type, target_user_id);

-- Done ✅  Public voices still work (target_user_id IS NULL).
--          Private voices are stored with target_user_id = recipient UUID.
