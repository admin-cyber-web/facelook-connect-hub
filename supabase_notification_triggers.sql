-- ═══════════════════════════════════════════════════════════════════════════
--  FLICKS NOTIFICATION TRIGGERS — Likes, Comments, Reports
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. LIKE NOTIFICATIONS ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_like() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  post_author_id uuid;
  liker_name text;
BEGIN
  -- Get the post owner
  SELECT author_id INTO post_author_id FROM posts WHERE id = NEW.post_id;
  -- Don't notify if user liked their own post
  IF post_author_id = NEW.user_id THEN RETURN NEW; END IF;
  -- Get liker name
  SELECT full_name INTO liker_name FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
  VALUES (
    post_author_id,
    NEW.user_id,
    'like',
    NEW.post_id,
    'post',
    coalesce(liker_name, 'Someone') || ' liked your post'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_like ON likes;
CREATE TRIGGER trg_notify_like
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION notify_like();

-- ── 2. COMMENT NOTIFICATIONS ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_comment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  post_author_id uuid;
  commenter_name text;
BEGIN
  -- Get the post owner
  SELECT author_id INTO post_author_id FROM posts WHERE id = NEW.post_id;
  -- Don't notify if user commented on their own post
  IF post_author_id = NEW.user_id THEN RETURN NEW; END IF;
  -- Get commenter name
  SELECT full_name INTO commenter_name FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
  VALUES (
    post_author_id,
    NEW.user_id,
    'comment',
    NEW.post_id,
    'post',
    coalesce(commenter_name, 'Someone') || ' commented: "' || substring(NEW.content, 1, 80) || '"'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_comment ON comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_comment();

-- ── 3. REPORT NOTIFICATIONS (Admin) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_report() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  admin_id uuid;
  reporter_name text;
BEGIN
  -- Notify the reported user (their content was reported)
  SELECT full_name INTO reporter_name FROM profiles WHERE id = NEW.reporter_id;
  INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
  VALUES (
    NEW.reported_user_id,
    NEW.reporter_id,
    'report_submitted',
    NEW.id,
    'report',
    coalesce(reporter_name, 'Someone') || ' reported your content. Reason: ' || coalesce(NEW.reason, 'unspecified')
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_report ON reports;
CREATE TRIGGER trg_notify_report
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION notify_report();

-- ── 4. STORY LIKE NOTIFICATIONS ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_story_like() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  story_owner_id uuid;
  liker_name text;
BEGIN
  -- Get story owner
  SELECT user_id INTO story_owner_id FROM stories WHERE id = NEW.story_id;
  IF story_owner_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO liker_name FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
  VALUES (
    story_owner_id,
    NEW.user_id,
    'story_like',
    NEW.story_id,
    'story',
    coalesce(liker_name, 'Someone') || ' liked your story'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_story_like ON story_likes;
CREATE TRIGGER trg_notify_story_like
  AFTER INSERT ON story_likes
  FOR EACH ROW EXECUTE FUNCTION notify_story_like();

-- ── 5. CIRCLE POST LIKE NOTIFICATIONS ──────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_circle_post_like() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  post_author_id uuid;
  liker_name text;
BEGIN
  SELECT author_id INTO post_author_id FROM circle_posts WHERE id = NEW.post_id;
  IF post_author_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO liker_name FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
  VALUES (
    post_author_id,
    NEW.user_id,
    'like',
    NEW.post_id,
    'circle_post',
    coalesce(liker_name, 'Someone') || ' liked your circle post'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_circle_post_like ON circle_post_likes;
CREATE TRIGGER trg_notify_circle_post_like
  AFTER INSERT ON circle_post_likes
  FOR EACH ROW EXECUTE FUNCTION notify_circle_post_like();

-- ── 6. CIRCLE POST COMMENT NOTIFICATIONS ───────────────────────────────────
CREATE OR REPLACE FUNCTION notify_circle_post_comment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  post_author_id uuid;
  commenter_name text;
BEGIN
  SELECT author_id INTO post_author_id FROM circle_posts WHERE id = NEW.post_id;
  IF post_author_id = NEW.author_id THEN RETURN NEW; END IF;
  SELECT full_name INTO commenter_name FROM profiles WHERE id = NEW.author_id;
  INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
  VALUES (
    post_author_id,
    NEW.author_id,
    'comment',
    NEW.post_id,
    'circle_post',
    coalesce(commenter_name, 'Someone') || ' commented: "' || substring(NEW.content, 1, 80) || '"'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_circle_post_comment ON circle_post_comments;
CREATE TRIGGER trg_notify_circle_post_comment
  AFTER INSERT ON circle_post_comments
  FOR EACH ROW EXECUTE FUNCTION notify_circle_post_comment();

-- ═══════════════════════════════════════════════════════════════════════════
