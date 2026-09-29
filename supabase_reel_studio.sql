-- Reel Studio metadata and curated music library.
-- Safe to run more than once in the Supabase SQL editor.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS filters TEXT;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS playback_rate NUMERIC(3, 1) DEFAULT 1.0;

CREATE TABLE IF NOT EXISTS public.reel_music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'Flicks Studio',
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reel_music_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active reel music" ON public.reel_music_tracks;
CREATE POLICY "Public read active reel music"
  ON public.reel_music_tracks FOR SELECT
  USING (is_active = TRUE);