-- ═══════════════════════════════════════════════════════════════════
--  Flicks — Stories & Story Views schema (v2)
--  Run this in Supabase SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Create / extend stories table ────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url        text NOT NULL,
  caption          text,
  emoji            text,
  -- v2 columns (add if upgrading from v1)
  mood             text,            -- 'happy' | 'sad' | 'love' | 'angry' | 'party' | 'chill'
  media_type       text,            -- 'image' | 'voice'
  is_help_request  boolean DEFAULT false,
  music_url        text,            -- background music auto-played during viewing
  created_at       timestamptz DEFAULT now()
);

-- Add v2 columns to existing table (safe — no-ops if already present)
ALTER TABLE stories ADD COLUMN IF NOT EXISTS mood            text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS media_type      text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_help_request boolean DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS music_url       text;

-- ── 2. Enable RLS ────────────────────────────────────────────────────
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- ── 3. RLS Policies ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Public read stories'
  ) THEN
    CREATE POLICY "Public read stories"
      ON stories FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Owner insert stories'
  ) THEN
    CREATE POLICY "Owner insert stories"
      ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Owner delete stories'
  ) THEN
    CREATE POLICY "Owner delete stories"
      ON stories FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user_id    ON stories(user_id);

-- ── 5. story_views table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_views (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   uuid REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id  uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at  timestamptz DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_views' AND policyname = 'Owner reads own story views'
  ) THEN
    CREATE POLICY "Owner reads own story views"
      ON story_views FOR SELECT
      USING (
        viewer_id = auth.uid()
        OR story_id IN (SELECT id FROM stories WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_views' AND policyname = 'Auth insert story view'
  ) THEN
    CREATE POLICY "Auth insert story view"
      ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_story_views_story_id  ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON story_views(viewer_id);

-- ── 6. Enable Realtime ───────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE stories;

-- ── 7. Storage bucket note ───────────────────────────────────────────
-- Ensure the "avatars" bucket is public and allows authenticated uploads:
-- Dashboard → Storage → avatars → Policies
-- Policy: allow authenticated INSERT/SELECT to any path
-- Done!
