-- Run this in Supabase SQL Editor → New Query
-- This sets up the stories table needed for the Story feature in ChatSystem

-- 1. Create stories table
CREATE TABLE IF NOT EXISTS stories (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url   text NOT NULL,
  caption     text,
  emoji       text,
  created_at  timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (open read, auth insert/delete)
CREATE POLICY "Public read stories"
  ON stories FOR SELECT USING (true);

CREATE POLICY "Owner insert stories"
  ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner delete stories"
  ON stories FOR DELETE USING (auth.uid() = user_id);

-- 4. Index for fast queries (last 24h)
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user_id    ON stories(user_id);

-- 5. Enable Realtime (optional — for live story updates)
ALTER PUBLICATION supabase_realtime ADD TABLE stories;

-- 6. Storage: Make sure the "avatars" bucket exists and allows the stories/ path
-- Go to Supabase Dashboard → Storage → avatars bucket → Policies
-- Add policy: Allow authenticated users to upload to any path
-- Or run this (only if using service role):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- Done! Now the story upload in ChatSystem will work.
