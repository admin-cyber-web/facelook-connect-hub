-- Run this in your Supabase SQL Editor → New Query

-- 1. Hook Pages (like Facebook Pages)
CREATE TABLE IF NOT EXISTS hook_pages (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  category      text DEFAULT 'General',
  cover_url     text,
  avatar_url    text,
  follower_count int  DEFAULT 0,
  hook_count    int  DEFAULT 0,
  post_count    int  DEFAULT 0,
  like_count    int  DEFAULT 0,
  is_monetized  boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- 2. Posts on Hook Pages
CREATE TABLE IF NOT EXISTS hook_page_posts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id     uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES profiles(id),
  content     text,
  media_url   text,
  media_type  text DEFAULT '',
  likes_count int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- 3. Hook Invites (who invited whom to which page)
CREATE TABLE IF NOT EXISTS hook_invites (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id     uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  inviter_id  uuid REFERENCES profiles(id),
  invitee_id  uuid REFERENCES profiles(id),
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(page_id, invitee_id)
);

-- 4. Hook Page Members
CREATE TABLE IF NOT EXISTS hook_members (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id   uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(page_id, user_id)
);

-- Enable RLS (Row Level Security)
ALTER TABLE hook_pages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_page_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_invites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_members    ENABLE ROW LEVEL SECURITY;

-- Open read/write policies (adjust as needed)
CREATE POLICY "Public read hook_pages"      ON hook_pages      FOR SELECT USING (true);
CREATE POLICY "Owner insert hook_pages"     ON hook_pages      FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner update hook_pages"     ON hook_pages      FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner delete hook_pages"     ON hook_pages      FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Public read hook_page_posts" ON hook_page_posts FOR SELECT USING (true);
CREATE POLICY "Author insert hook_posts"    ON hook_page_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author delete hook_posts"    ON hook_page_posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Public read hook_invites"    ON hook_invites    FOR SELECT USING (true);
CREATE POLICY "Inviter insert hook_invites" ON hook_invites    FOR INSERT WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "Update hook_invites"         ON hook_invites    FOR UPDATE USING (true);

CREATE POLICY "Public read hook_members"    ON hook_members    FOR SELECT USING (true);
CREATE POLICY "Self insert hook_members"    ON hook_members    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Self update hook_members"    ON hook_members    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Self delete hook_members"    ON hook_members    FOR DELETE USING (auth.uid() = user_id);

-- ── 5. Page Followers (dedicated follow/join table) ────────────────────────────
-- Run these if you haven't already:

-- Add followers_count column to hook_pages (skip if it already exists)
ALTER TABLE hook_pages ADD COLUMN IF NOT EXISTS followers_count int DEFAULT 0;

-- Create page_followers table
CREATE TABLE IF NOT EXISTS page_followers (
  page_id   uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id)   ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (page_id, user_id)
);

ALTER TABLE page_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read page_followers"  ON page_followers FOR SELECT USING (true);
CREATE POLICY "Self insert page_followers"  ON page_followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Self delete page_followers"  ON page_followers FOR DELETE USING (auth.uid() = user_id);

-- Allow hook_pages owners (and followers logic) to update followers_count
CREATE POLICY "Anyone update page followers_count" ON hook_pages FOR UPDATE
  USING (true) WITH CHECK (true);
-- (Tighten this policy in production — scope it to the count field only via a trigger if needed)

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS TABLE  (Facebook-style — full featured)
-- Run this section separately if you already ran the section above.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old simple notifications table if it exists (backs up nothing — all notifs are ephemeral UI)
-- Uncomment the line below ONLY if you want a clean slate:
-- DROP TABLE IF EXISTS notifications;

CREATE TABLE IF NOT EXISTS notifications (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  notifier_id  uuid         REFERENCES profiles(id) ON DELETE CASCADE,  -- who receives this
  actor_id     uuid         REFERENCES profiles(id) ON DELETE CASCADE,  -- who triggered it
  type         text         NOT NULL DEFAULT 'general',
  -- type values: 'like' | 'comment' | 'follow' | 'friend_request' | 'friend_accepted'
  --              | 'circle_join' | 'new_post' | 'mention' | 'general'
  entity_id    uuid,        -- optional: post id, page id, circle id, etc.
  entity_type  text,        -- optional: 'post' | 'page' | 'circle'
  content      text,        -- human-readable message (e.g. "Rahul ne like kiya")
  is_read      boolean      NOT NULL DEFAULT false,
  created_at   timestamptz  DEFAULT now()
);

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_notifications_notifier_id ON notifications(notifier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id    ON notifications(actor_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "notif_select_own" ON notifications
  FOR SELECT USING (auth.uid() = notifier_id);

CREATE POLICY "notif_insert_auth" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = notifier_id);

CREATE POLICY "notif_delete_own" ON notifications
  FOR DELETE USING (auth.uid() = notifier_id);

-- Enable Realtime for instant bell icon updates
-- (Run in Supabase Dashboard → Database → Replication → Add table)
-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Auto-create notification when a friend request is sent
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  sender_name text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT full_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
    INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
    VALUES (
      NEW.receiver_id,
      NEW.sender_id,
      'friend_request',
      NEW.id,
      'friendship',
      COALESCE(sender_name, 'Kisi ne') || ' ne aapko friend request bheji'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_request ON friendships;
CREATE TRIGGER trg_notify_friend_request
  AFTER INSERT ON friendships
  FOR EACH ROW EXECUTE FUNCTION notify_friend_request();

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Auto-create notification when friend request is accepted
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_friend_accepted()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  acceptor_name text;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT full_name INTO acceptor_name FROM profiles WHERE id = NEW.receiver_id;
    INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
    VALUES (
      NEW.sender_id,
      NEW.receiver_id,
      'friend_accepted',
      NEW.id,
      'friendship',
      COALESCE(acceptor_name, 'Kisi ne') || ' ne aapki friend request accept ki'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_accepted ON friendships;
CREATE TRIGGER trg_notify_friend_accepted
  AFTER UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION notify_friend_accepted();
