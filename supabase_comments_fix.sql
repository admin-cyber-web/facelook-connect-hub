-- =====================================================
-- COMMENTS TABLE — RLS POLICIES FIX
-- Run this once in Supabase SQL Editor
-- =====================================================

-- 1. Enable RLS on comments table (if not already enabled)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 2. DROP old/broken policies first (safe to run even if they don't exist)
DROP POLICY IF EXISTS "comments_select_all"        ON public.comments;
DROP POLICY IF EXISTS "comments_insert_own"        ON public.comments;
DROP POLICY IF EXISTS "comments_update_own"        ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own"        ON public.comments;
DROP POLICY IF EXISTS "comments_delete_admin"      ON public.comments;
DROP POLICY IF EXISTS "allow all"                  ON public.comments;

-- 3. SELECT: Everyone can read all comments
CREATE POLICY "comments_select_all"
  ON public.comments FOR SELECT
  USING (true);

-- 4. INSERT: Logged-in user can insert their own comment (author_id = auth.uid())
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- 5. UPDATE: User can edit only their own comment
CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  USING (auth.uid() = author_id);

-- 6. DELETE: User can delete their own comment
--            Post owner can also delete comments on their own post
--            Admin emails can delete any comment
CREATE POLICY "comments_delete_own"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = author_id
    OR auth.uid() IN (
      SELECT author_id FROM public.posts WHERE id = comments.post_id
    )
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );

-- =====================================================
-- CIRCLE_POST_COMMENTS TABLE — RLS POLICIES FIX
-- =====================================================

ALTER TABLE public.circle_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "circle_comments_select_all"   ON public.circle_post_comments;
DROP POLICY IF EXISTS "circle_comments_insert_own"   ON public.circle_post_comments;
DROP POLICY IF EXISTS "circle_comments_update_own"   ON public.circle_post_comments;
DROP POLICY IF EXISTS "circle_comments_delete_own"   ON public.circle_post_comments;
DROP POLICY IF EXISTS "allow all"                    ON public.circle_post_comments;

CREATE POLICY "circle_comments_select_all"
  ON public.circle_post_comments FOR SELECT
  USING (true);

CREATE POLICY "circle_comments_insert_own"
  ON public.circle_post_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "circle_comments_update_own"
  ON public.circle_post_comments FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "circle_comments_delete_own"
  ON public.circle_post_comments FOR DELETE
  USING (
    auth.uid() = author_id
    OR auth.uid() IN (
      SELECT author_id FROM public.circle_posts WHERE id = circle_post_comments.post_id
    )
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );

-- =====================================================
-- POSTS TABLE — RLS POLICIES FIX
-- =====================================================

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_all"    ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own"    ON public.posts;
DROP POLICY IF EXISTS "posts_update_own"    ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own"    ON public.posts;
DROP POLICY IF EXISTS "allow all"           ON public.posts;

CREATE POLICY "posts_select_all"
  ON public.posts FOR SELECT
  USING (true);

CREATE POLICY "posts_insert_own"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_update_own"
  ON public.posts FOR UPDATE
  USING (
    auth.uid() = author_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );

CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE
  USING (
    auth.uid() = author_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );

-- =====================================================
-- LIKES TABLE — RLS POLICIES FIX (uses user_id column)
-- =====================================================

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_all"   ON public.likes;
DROP POLICY IF EXISTS "likes_insert_own"   ON public.likes;
DROP POLICY IF EXISTS "likes_delete_own"   ON public.likes;
DROP POLICY IF EXISTS "allow all"          ON public.likes;

CREATE POLICY "likes_select_all"
  ON public.likes FOR SELECT
  USING (true);

CREATE POLICY "likes_insert_own"
  ON public.likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete_own"
  ON public.likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "likes_update_own"
  ON public.likes FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- PROFILES TABLE — RLS (basic safety)
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "allow all"             ON public.profiles;

CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
