-- ============================================================
-- Antakshari Arena — Supabase Schema
-- Run once in Supabase SQL Editor
-- ============================================================

-- Add fields to existing profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS antakshari_level        int  NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS antakshari_xp           int  NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS antakshari_coins        int  NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS antakshari_matches      int  NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS antakshari_wins         int  NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS fair_play_score         int  NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS country                 text,
ADD COLUMN IF NOT EXISTS bio                     text;

-- Followers table (new, separate from friendships)
CREATE TABLE IF NOT EXISTS followers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followers_own" ON followers FOR ALL USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Antakshari Rooms
CREATE TABLE IF NOT EXISTS antakshari_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  theme         text NOT NULL DEFAULT 'Bollywood',
  max_players   int  NOT NULL DEFAULT 4,
  host_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_public     boolean NOT NULL DEFAULT true,
  status        text NOT NULL DEFAULT 'waiting', -- waiting | playing | finished
  current_word  text,
  current_singer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  round_number  int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE antakshari_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_all" ON antakshari_rooms FOR ALL USING (true);

-- Room Members
CREATE TABLE IF NOT EXISTS antakshari_room_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES antakshari_rooms(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_ready    boolean NOT NULL DEFAULT false,
  is_host     boolean NOT NULL DEFAULT false,
  score       int  NOT NULL DEFAULT 0,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
ALTER TABLE antakshari_room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_members_all" ON antakshari_room_members FOR ALL USING (true);

-- Antakshari Matches (game sessions)
CREATE TABLE IF NOT EXISTS antakshari_matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       uuid NOT NULL REFERENCES antakshari_rooms(id) ON DELETE CASCADE,
  winner_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  theme         text NOT NULL,
  total_rounds  int  NOT NULL DEFAULT 0,
  started_at    timestamptz,
  ended_at      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE antakshari_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_all" ON antakshari_matches FOR ALL USING (true);

-- Rounds
CREATE TABLE IF NOT EXISTS antakshari_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid NOT NULL REFERENCES antakshari_matches(id) ON DELETE CASCADE,
  singer_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word          text NOT NULL,
  song_name     text,
  round_number  int  NOT NULL,
  status        text NOT NULL DEFAULT 'singing', -- singing | voting | done
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE antakshari_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rounds_all" ON antakshari_rounds FOR ALL USING (true);

-- Votes (Community Voting)
CREATE TABLE IF NOT EXISTS antakshari_votes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id      uuid NOT NULL REFERENCES antakshari_rounds(id) ON DELETE CASCADE,
  voter_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type     text NOT NULL CHECK (vote_type IN ('right','wrong','skip')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(round_id, voter_id)
);
ALTER TABLE antakshari_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_all" ON antakshari_votes FOR ALL USING (true);

-- Leaderboard
CREATE TABLE IF NOT EXISTS antakshari_leaderboard (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period        text NOT NULL CHECK (period IN ('weekly','monthly','global')),
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  score         int  NOT NULL DEFAULT 0,
  wins          int  NOT NULL DEFAULT 0,
  matches       int  NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period, period_start)
);
ALTER TABLE antakshari_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaderboard_all" ON antakshari_leaderboard FOR ALL USING (true);

-- Coin Wallet (one row per user)
CREATE TABLE IF NOT EXISTS coin_wallet (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  balance       int  NOT NULL DEFAULT 100,
  total_earned  int  NOT NULL DEFAULT 0,
  total_spent   int  NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coin_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_own" ON coin_wallet FOR ALL USING (auth.uid() = user_id);

-- Coin Transactions
CREATE TABLE IF NOT EXISTS coin_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount        int  NOT NULL,
  type          text NOT NULL CHECK (type IN ('earn','spend','gift')),
  reason        text NOT NULL,
  match_id      uuid REFERENCES antakshari_matches(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_own" ON coin_transactions FOR ALL USING (auth.uid() = user_id);

-- Achievements
CREATE TABLE IF NOT EXISTS antakshari_achievements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text NOT NULL,
  icon          text,
  unlocked_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE antakshari_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_own" ON antakshari_achievements FOR ALL USING (auth.uid() = user_id);

-- Gifts (Audience gifting players)
CREATE TABLE IF NOT EXISTS antakshari_gifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid NOT NULL REFERENCES antakshari_matches(id) ON DELETE CASCADE,
  from_user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gift_type     text NOT NULL,
  coin_amount   int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE antakshari_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts_all" ON antakshari_gifts FOR ALL USING (true);
