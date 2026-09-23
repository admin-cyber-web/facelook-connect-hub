-- =====================================================================
-- COMMENTS SETUP — Run once in Supabase SQL Editor
-- Fixes: user_id column, insert RLS, comments_count trigger
-- =====================================================================

-- 1. Make sure comments table has all needed columns
--    DB uses user_id (NOT author_id) for the commenter
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_hidden      boolean DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS hidden_by_id   uuid;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS hidden_by_name text;

-- 2. Add comments_count to posts (if not already done)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

-- 3. Trigger function to keep comments_count in sync
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
      SET comments_count = COALESCE(comments_count, 0) + 1
      WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
      SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
      WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 4. Attach trigger to comments table
DROP TRIGGER IF EXISTS trg_post_comments_count ON public.comments;
CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

-- 5. Backfill existing counts
UPDATE public.posts p
SET comments_count = (
  SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id
);

-- =====================================================================
-- RLS POLICIES — Uses user_id (the commenter's auth.uid)
-- =====================================================================

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_all"   ON public.comments;
DROP POLICY IF EXISTS "comments_insert_own"   ON public.comments;
DROP POLICY IF EXISTS "comments_update_own"   ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own"   ON public.comments;
DROP POLICY IF EXISTS "allow all"             ON public.comments;

-- Anyone can read
CREATE POLICY "comments_select_all"
  ON public.comments FOR SELECT USING (true);

-- Logged-in user inserts with their own user_id
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- User can update their own comment
CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);

-- User, post-owner, or admin can delete
CREATE POLICY "comments_delete_own"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT author_id FROM public.posts WHERE id = comments.post_id)
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
        IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );
