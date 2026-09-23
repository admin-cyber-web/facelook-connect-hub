-- ============================================================
-- Flicks India — Location + Interests + Recommendation Prefs
-- Run this migration in the Supabase SQL editor
-- ============================================================

-- Add structured location columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS state      text,
  ADD COLUMN IF NOT EXISTS district   text,
  ADD COLUMN IF NOT EXISTS city       text,
  ADD COLUMN IF NOT EXISTS pincode    text;

-- Add interests as text array (stores tags like "Cricket","Music")
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS interests  text[] DEFAULT '{}';

-- Add recommendation preference toggles (default ON for new users)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rec_local_first    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS rec_people_nearby  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS rec_interests      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS rec_new_users      boolean DEFAULT true;

-- Indexes for fast geo-based recommendation queries
-- (partial index: only public profiles are ever recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_district
  ON profiles(district)
  WHERE is_private_mode = false AND profile_hidden = false;

CREATE INDEX IF NOT EXISTS idx_profiles_state
  ON profiles(state)
  WHERE is_private_mode = false AND profile_hidden = false;

CREATE INDEX IF NOT EXISTS idx_profiles_city
  ON profiles(city)
  WHERE is_private_mode = false AND profile_hidden = false;

-- Index to quickly find recently joined public users for "New in Your Area"
CREATE INDEX IF NOT EXISTS idx_profiles_created_public
  ON profiles(created_at DESC)
  WHERE is_private_mode = false AND profile_hidden = false;
