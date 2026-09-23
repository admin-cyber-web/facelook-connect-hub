-- ═══════════════════════════════════════════════════════════════════════════
--  FLICKS — NOTIFICATION TRIGGER FIX
--  Root cause: triggers lacked SECURITY DEFINER so auth.uid() returned NULL
--  inside the trigger context, causing RLS to silently block the INSERT into
--  notifications (or allowing inserts with NULL IDs).
--
--  Fix: All functions use SECURITY DEFINER SET search_path = public so they
--  run as the function owner (postgres) and bypass RLS entirely. Explicit NULL
--  guards ensure no row is ever inserted unless BOTH IDs are known.
--
--  Column convention (DO NOT CHANGE):
--    notifier_id  = the person who RECEIVES the notification (post owner)
--    actor_id     = the person who PERFORMED the action (liker / commenter / sharer)
--
--  Run this ONCE in Supabase SQL Editor (safe to re-run — all are OR REPLACE / IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. LIKE NOTIFICATION ──────────────────────────────────────────────────────
--  Fires when a row is INSERTed into the `likes` table.
--  NEW.user_id  = the person who liked  (actor)
--  NEW.post_id  → look up posts.author_id = the post owner (notifier / recipient)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_liker_name     text;
BEGIN
  -- Resolve the post owner
  SELECT author_id
    INTO v_post_author_id
    FROM posts
   WHERE id = NEW.post_id;

  -- Hard guard: skip if we could not resolve either party
  IF v_post_author_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip self-like
  IF v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Resolve liker display name (best-effort, fallback to 'Someone')
  SELECT full_name
    INTO v_liker_name
    FROM profiles
   WHERE id = NEW.user_id;

  INSERT INTO notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (
      v_post_author_id,           -- recipient  = post owner
      NEW.user_id,                -- sender     = the liker
      'like',
      NEW.post_id,
      'post',
      COALESCE(v_liker_name, 'Someone') || ' liked your post',
      false
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_like ON likes;
CREATE TRIGGER trg_notify_like
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_like();


-- ── 2. COMMENT NOTIFICATION ───────────────────────────────────────────────────
--  Fires when a row is INSERTed into the `comments` table.
--  NOTE: comments table uses `user_id` for the commenter (NOT author_id).
--  NEW.user_id  = commenter  (actor)
--  NEW.post_id  → look up posts.author_id = post owner  (notifier / recipient)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id  uuid;
  v_commenter_name  text;
  v_preview         text;
BEGIN
  -- Resolve the post owner
  SELECT author_id
    INTO v_post_author_id
    FROM posts
   WHERE id = NEW.post_id;

  -- Hard guard
  IF v_post_author_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip self-comment
  IF v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Resolve commenter name
  SELECT full_name
    INTO v_commenter_name
    FROM profiles
   WHERE id = NEW.user_id;

  -- Content preview — cap at 80 chars
  v_preview := SUBSTRING(COALESCE(NEW.content, ''), 1, 80);

  INSERT INTO notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (
      v_post_author_id,
      NEW.user_id,
      'comment',
      NEW.post_id,
      'post',
      COALESCE(v_commenter_name, 'Someone') || ' commented: "' || v_preview || '"',
      false
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment ON comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment();


-- ── 3. SHARE NOTIFICATION ─────────────────────────────────────────────────────
--  Fires when a row is INSERTed into the `shares` table.
--  NEW.user_id = the sharer  (actor)
--  NEW.post_id → look up posts.author_id = post owner  (notifier / recipient)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_share()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_sharer_name    text;
BEGIN
  -- Resolve the post owner
  SELECT author_id
    INTO v_post_author_id
    FROM posts
   WHERE id = NEW.post_id;

  -- Hard guard
  IF v_post_author_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip self-share
  IF v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Resolve sharer name
  SELECT full_name
    INTO v_sharer_name
    FROM profiles
   WHERE id = NEW.user_id;

  INSERT INTO notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (
      v_post_author_id,
      NEW.user_id,
      'share',
      NEW.post_id,
      'post',
      COALESCE(v_sharer_name, 'Someone') || ' shared your post',
      false
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_share ON shares;
CREATE TRIGGER trg_notify_share
  AFTER INSERT ON shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_share();


-- ── 4. STORY LIKE NOTIFICATION ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_story_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story_owner_id uuid;
  v_liker_name     text;
BEGIN
  SELECT user_id
    INTO v_story_owner_id
    FROM stories
   WHERE id = NEW.story_id;

  IF v_story_owner_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_story_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name
    INTO v_liker_name
    FROM profiles
   WHERE id = NEW.user_id;

  INSERT INTO notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (
      v_story_owner_id,
      NEW.user_id,
      'story_like',
      NEW.story_id,
      'story',
      COALESCE(v_liker_name, 'Someone') || ' liked your story',
      false
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_story_like ON story_likes;
CREATE TRIGGER trg_notify_story_like
  AFTER INSERT ON story_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_story_like();


-- ── 5. CIRCLE POST LIKE NOTIFICATION ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_circle_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_liker_name     text;
BEGIN
  SELECT author_id
    INTO v_post_author_id
    FROM circle_posts
   WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name
    INTO v_liker_name
    FROM profiles
   WHERE id = NEW.user_id;

  INSERT INTO notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (
      v_post_author_id,
      NEW.user_id,
      'like',
      NEW.post_id,
      'circle_post',
      COALESCE(v_liker_name, 'Someone') || ' liked your circle post',
      false
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_circle_post_like ON circle_post_likes;
CREATE TRIGGER trg_notify_circle_post_like
  AFTER INSERT ON circle_post_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_circle_post_like();


-- ── 6. CIRCLE POST COMMENT NOTIFICATION ───────────────────────────────────────
--  NOTE: circle_post_comments uses `author_id` for the commenter (not user_id).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_circle_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id  uuid;
  v_commenter_name  text;
  v_preview         text;
BEGIN
  SELECT author_id
    INTO v_post_author_id
    FROM circle_posts
   WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR NEW.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_post_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name
    INTO v_commenter_name
    FROM profiles
   WHERE id = NEW.author_id;

  v_preview := SUBSTRING(COALESCE(NEW.content, ''), 1, 80);

  INSERT INTO notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (
      v_post_author_id,
      NEW.author_id,
      'comment',
      NEW.post_id,
      'circle_post',
      COALESCE(v_commenter_name, 'Someone') || ' commented: "' || v_preview || '"',
      false
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_circle_post_comment ON circle_post_comments;
CREATE TRIGGER trg_notify_circle_post_comment
  AFTER INSERT ON circle_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_circle_post_comment();


-- ── 7. FRIEND REQUEST NOTIFICATION ───────────────────────────────────────────
--  Re-written with SECURITY DEFINER for consistency.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id IS NULL OR NEW.receiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name
    INTO v_sender_name
    FROM profiles
   WHERE id = NEW.sender_id;

  INSERT INTO notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (
      NEW.receiver_id,
      NEW.sender_id,
      'friend_request',
      NEW.id,
      'friendship',
      COALESCE(v_sender_name, 'Someone') || ' sent you a friend request',
      false
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_request ON friendships;
CREATE TRIGGER trg_notify_friend_request
  AFTER INSERT ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION notify_friend_request();


-- ── 8. FRIEND ACCEPTED NOTIFICATION ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_friend_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acceptor_name text;
BEGIN
  -- Only fire when status transitions to 'accepted'
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id IS NULL OR NEW.receiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name
    INTO v_acceptor_name
    FROM profiles
   WHERE id = NEW.receiver_id;

  INSERT INTO notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (
      NEW.sender_id,
      NEW.receiver_id,
      'friend_accepted',
      NEW.id,
      'friendship',
      COALESCE(v_acceptor_name, 'Someone') || ' accepted your friend request',
      false
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_accepted ON friendships;
CREATE TRIGGER trg_notify_friend_accepted
  AFTER UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION notify_friend_accepted();


-- ── 9. REPORT NOTIFICATION (admin awareness) ──────────────────────────────────
CREATE OR REPLACE FUNCTION notify_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_name text;
BEGIN
  IF NEW.reported_user_id IS NULL OR NEW.reporter_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name
    INTO v_reporter_name
    FROM profiles
   WHERE id = NEW.reporter_id;

  INSERT INTO notifications
    (notifier_id, actor_id, type, entity_id, entity_type, content, is_read)
  VALUES
    (
      NEW.reported_user_id,
      NEW.reporter_id,
      'report_submitted',
      NEW.id,
      'report',
      COALESCE(v_reporter_name, 'Someone') || ' reported your content. Reason: ' || COALESCE(NEW.reason, 'unspecified'),
      false
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_report ON reports;
CREATE TRIGGER trg_notify_report
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_report();


-- ═══════════════════════════════════════════════════════════════════════════
--  VERIFICATION QUERIES — run these after the above to confirm setup
-- ═══════════════════════════════════════════════════════════════════════════
/*
-- Check all notification triggers are present:
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_notify%'
ORDER BY event_object_table;

-- Spot-check recent notifications for null IDs:
SELECT id, notifier_id, actor_id, type, created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 20;
*/
