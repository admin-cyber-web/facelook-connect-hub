-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN RLS POLICIES — Run once in your Supabase SQL editor
-- Allows admin emails to delete/moderate any post or ban any user.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ensure the likes table has a UNIQUE constraint so upsert works correctly.
--    (Required for "like" persistence — if missing, upsert silently fails)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'likes_post_id_user_id_key'
      AND conrelid = 'likes'::regclass
  ) THEN
    ALTER TABLE likes ADD CONSTRAINT likes_post_id_user_id_key UNIQUE (post_id, user_id);
  END IF;
END $$;

-- 2. Allow admin emails to DELETE any post (bypasses owner-only RLS).
--    posts table uses author_id (NOT user_id) for the post author.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'admin_delete_posts'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_delete_posts" ON posts
      FOR DELETE
      USING (
        auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
        OR auth.uid() = author_id
      );
    $policy$;
  END IF;
END $$;

-- 3. Allow admin emails to UPDATE any post (for future moderation features).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'admin_update_posts'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_update_posts" ON posts
      FOR UPDATE
      USING (
        auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
        OR auth.uid() = author_id
      );
    $policy$;
  END IF;
END $$;

-- 4. Allow ALL authenticated users to DELETE their own posts.
--    posts table: author column is author_id (no user_id column on posts).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'owner_delete_posts'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "owner_delete_posts" ON posts
      FOR DELETE
      USING (
        auth.uid() = author_id
      );
    $policy$;
  END IF;
END $$;
