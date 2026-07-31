-- ═══════════════════════════════════════════════════════════════════════════
-- Flicks India — Recommendation System Migration
-- Run this SQL in your Supabase SQL Editor (Database > SQL Editor > New Query)
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Add location + interest + recommendation preference columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS state              TEXT,
  ADD COLUMN IF NOT EXISTS district           TEXT,
  ADD COLUMN IF NOT EXISTS city               TEXT,
  ADD COLUMN IF NOT EXISTS pincode            TEXT,
  ADD COLUMN IF NOT EXISTS locality           TEXT,
  ADD COLUMN IF NOT EXISTS interests          TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rec_local_first    BOOLEAN  DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS rec_people_nearby  BOOLEAN  DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS rec_interests      BOOLEAN  DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS rec_new_users      BOOLEAN  DEFAULT TRUE;

-- Step 2: Indexes for fast location-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_state      ON profiles(state)    WHERE state    IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_district   ON profiles(district) WHERE district IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_city       ON profiles(city)     WHERE city     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Step 3: (Optional) recommendation analytics table
CREATE TABLE IF NOT EXISTS recommendation_events (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID         REFERENCES profiles(id) ON DELETE CASCADE,
  rec_type   TEXT         NOT NULL,   -- 'local_person' | 'interest_match' | 'new_in_area'
  entity_id  UUID,
  reason     TEXT,
  score      FLOAT,
  dismissed  BOOLEAN      DEFAULT FALSE,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rec_events_user ON recommendation_events(user_id);
ALTER TABLE recommendation_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recommendation_events' AND policyname = 'Users manage own rec events'
  ) THEN
    CREATE POLICY "Users manage own rec events"
      ON recommendation_events FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Done!
SELECT 'Recommendation system migration complete ✅' AS status;
