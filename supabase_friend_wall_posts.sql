-- Friend timeline posts
-- Run after the core posts, friendships, likes, comments, shares, and
-- notifications schemas have been created.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS wall_owner_id uuid
  REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS posts_wall_owner_created_at_idx
  ON public.posts (wall_owner_id, created_at DESC)
  WHERE wall_owner_id IS NOT NULL;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Preserve the existing public behavior for regular posts while respecting
-- the target profile's lock/private settings for timeline posts.
DROP POLICY IF EXISTS "Public read posts" ON public.posts;
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
DROP POLICY IF EXISTS "anyone_can_read_admin_posts" ON public.posts;
CREATE POLICY "posts_select_all"
  ON public.posts
  FOR SELECT
  USING (
    wall_owner_id IS NULL
    OR auth.uid() = wall_owner_id
    OR auth.uid() = author_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = wall_owner_id
        AND COALESCE(p.is_private_mode, false) = false
        AND COALESCE(p.profile_locked, false) = false
    )
    OR EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.sender_id = auth.uid() AND f.receiver_id = wall_owner_id)
          OR
          (f.receiver_id = auth.uid() AND f.sender_id = wall_owner_id)
        )
    )
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );

-- Replace the ordinary insert rule: a signed-in user may create a normal post,
-- post to their own wall, or post to a wall owned by an accepted friend.
DROP POLICY IF EXISTS "Owner insert post" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own"
  ON public.posts
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      wall_owner_id IS NULL
      OR wall_owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.sender_id = auth.uid() AND f.receiver_id = wall_owner_id)
            OR
            (f.receiver_id = auth.uid() AND f.sender_id = wall_owner_id)
          )
      )
    )
  );

-- Keep the same ownership/admin update permissions while preventing a post's
-- author from retargeting a wall post to a non-friend.
DROP POLICY IF EXISTS "Owner update post" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_own"
  ON public.posts
  FOR UPDATE
  USING (
    auth.uid() = author_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  )
  WITH CHECK (
    (
      auth.uid() = author_id
      OR (SELECT email FROM auth.users WHERE id = auth.uid())
        IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
    )
    AND (
      wall_owner_id IS NULL
      OR wall_owner_id = auth.uid()
      OR (SELECT email FROM auth.users WHERE id = auth.uid())
        IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
      OR EXISTS (
        SELECT 1
        FROM public.friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.sender_id = auth.uid() AND f.receiver_id = wall_owner_id)
            OR
            (f.receiver_id = auth.uid() AND f.sender_id = wall_owner_id)
          )
      )
    )
  );

-- Counts are maintained server-side so a visitor can react without requiring
-- permission to update another person's post row.
CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id uuid;
BEGIN
  v_post_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.post_id ELSE NEW.post_id END;
  UPDATE public.posts
     SET likes_count = (
       SELECT COUNT(*)::integer FROM public.likes WHERE post_id = v_post_id
     )
   WHERE id = v_post_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_friend_wall_likes_count ON public.likes;
CREATE TRIGGER trg_friend_wall_likes_count
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes_count();

CREATE OR REPLACE FUNCTION public.sync_post_shares_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id uuid;
BEGIN
  v_post_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.post_id ELSE NEW.post_id END;
  UPDATE public.posts
     SET shares_count = (
       SELECT COUNT(*)::integer FROM public.shares WHERE post_id = v_post_id
     )
   WHERE id = v_post_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_friend_wall_shares_count ON public.shares;
CREATE TRIGGER trg_friend_wall_shares_count
  AFTER INSERT OR DELETE ON public.shares
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_shares_count();

CREATE OR REPLACE FUNCTION public.sync_post_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id uuid;
BEGIN
  v_post_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.post_id ELSE NEW.post_id END;
  UPDATE public.posts
     SET comments_count = (
       SELECT COUNT(*)::integer FROM public.comments WHERE post_id = v_post_id
     )
   WHERE id = v_post_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_comments_count ON public.comments;
CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comments_count();

-- Wall post creation and all engagement notifications go to the wall owner;
-- ordinary posts continue to notify their author.
CREATE OR REPLACE FUNCTION public.notify_wall_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.wall_owner_id IS NULL
     OR NEW.author_id IS NULL
     OR NEW.wall_owner_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (NEW.wall_owner_id, NEW.author_id, 'wall_post', NEW.id, 'post',
     'posted on your timeline', false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_wall_post ON public.posts;
CREATE TRIGGER trg_notify_wall_post
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_wall_post();

CREATE OR REPLACE FUNCTION public.notify_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_actor_name text;
BEGIN
  SELECT COALESCE(wall_owner_id, author_id)
    INTO v_recipient_id
    FROM public.posts
   WHERE id = NEW.post_id;

  IF v_recipient_id IS NULL OR NEW.user_id IS NULL OR v_recipient_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_actor_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  INSERT INTO public.notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (v_recipient_id, NEW.user_id, 'like', NEW.post_id, 'post',
     COALESCE(v_actor_name, 'Someone') || ' liked your post', false);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_actor_name text;
BEGIN
  SELECT COALESCE(wall_owner_id, author_id)
    INTO v_recipient_id
    FROM public.posts
   WHERE id = NEW.post_id;

  IF v_recipient_id IS NULL OR NEW.user_id IS NULL OR v_recipient_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_actor_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  INSERT INTO public.notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (v_recipient_id, NEW.user_id, 'comment', NEW.post_id, 'post',
     COALESCE(v_actor_name, 'Someone') || ' commented: "' ||
       SUBSTRING(COALESCE(NEW.content, ''), 1, 80) || '"',
     false);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_actor_name text;
BEGIN
  SELECT COALESCE(wall_owner_id, author_id)
    INTO v_recipient_id
    FROM public.posts
   WHERE id = NEW.post_id;

  IF v_recipient_id IS NULL OR NEW.user_id IS NULL OR v_recipient_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_actor_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  INSERT INTO public.notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (v_recipient_id, NEW.user_id, 'share', NEW.post_id, 'post',
     COALESCE(v_actor_name, 'Someone') || ' shared your post', false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_like ON public.likes;
CREATE TRIGGER trg_notify_like
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_like();

DROP TRIGGER IF EXISTS trg_notify_comment ON public.comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment();

DROP TRIGGER IF EXISTS trg_notify_share ON public.shares;
CREATE TRIGGER trg_notify_share
  AFTER INSERT ON public.shares
  FOR EACH ROW EXECUTE FUNCTION public.notify_share();
