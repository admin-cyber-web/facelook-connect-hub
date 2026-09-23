-- ═══════════════════════════════════════════════════════════════════
--  Flicks — Story Likes schema (WhatsApp-style)
--  Run this in Supabase SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS story_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   uuid REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (story_id, user_id)
);

ALTER TABLE story_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_likes' AND policyname = 'Public read story likes'
  ) THEN
    CREATE POLICY "Public read story likes"
      ON story_likes FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_likes' AND policyname = 'Auth insert story like'
  ) THEN
    CREATE POLICY "Auth insert story like"
      ON story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_likes' AND policyname = 'Owner delete own story like'
  ) THEN
    CREATE POLICY "Owner delete own story like"
      ON story_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user_id  ON story_likes(user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE story_likes;
