-- ── Flicks India: Autonomous News Poster — One-time Setup ─────────────────────
-- Run this ONCE in your Supabase SQL Editor before starting the autoPost worker.
-- Safe to re-run — all statements use IF NOT EXISTS / IF EXISTS guards.

-- 1. Add is_admin_post flag to posts table
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_admin_post boolean NOT NULL DEFAULT false;

-- 2. RLS policy: allow the anon / service key to INSERT bot posts
--    (is_admin_post = true + no author_id requirement)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'bot_can_insert_admin_posts'
  ) THEN
    CREATE POLICY bot_can_insert_admin_posts ON posts
      FOR INSERT
      WITH CHECK (is_admin_post = true);
  END IF;
END $$;

-- 3. Allow public SELECT on admin posts (so they appear in the feed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'anyone_can_read_admin_posts'
  ) THEN
    CREATE POLICY anyone_can_read_admin_posts ON posts
      FOR SELECT
      USING (is_admin_post = true OR auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 4. Index for fast dedup lookup (metadata->>'source_url')
CREATE INDEX IF NOT EXISTS idx_posts_source_url
  ON posts ((metadata->>'source_url'))
  WHERE is_admin_post = true;

-- 5. Index so the FameFeed query can efficiently filter admin posts
CREATE INDEX IF NOT EXISTS idx_posts_is_admin_post
  ON posts (is_admin_post)
  WHERE is_admin_post = true;

-- Verify
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'posts'
  AND column_name = 'is_admin_post';
