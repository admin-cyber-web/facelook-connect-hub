-- ═══════════════════════════════════════════════════════════════
--  MAGNET SYSTEM – Run these in the Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Magnet chain (recursive viral tree)
CREATE TABLE IF NOT EXISTS magnet_chains (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          TEXT NOT NULL,
  post_type        TEXT NOT NULL DEFAULT 'flick',   -- 'flick' | 'hook' | 'circle'
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  parent_magnet_id UUID REFERENCES magnet_chains(id) ON DELETE CASCADE,
  depth            INT  NOT NULL DEFAULT 0,
  is_killed        BOOL NOT NULL DEFAULT FALSE,
  is_muted         BOOL NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS magnet_post_idx    ON magnet_chains(post_id, post_type);
CREATE INDEX IF NOT EXISTS magnet_parent_idx  ON magnet_chains(parent_magnet_id);
CREATE INDEX IF NOT EXISTS magnet_user_idx    ON magnet_chains(user_id);
CREATE INDEX IF NOT EXISTS magnet_depth_idx   ON magnet_chains(post_id, depth);

-- 2. Creator's Voice (one row per post, UPSERT by owner)
CREATE TABLE IF NOT EXISTS post_magnet_voice (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      TEXT NOT NULL,
  post_type    TEXT NOT NULL DEFAULT 'flick',
  owner_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status_text  TEXT,
  is_warning   BOOL NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, post_type)
);

-- Enable realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE magnet_chains;
ALTER PUBLICATION supabase_realtime ADD TABLE post_magnet_voice;
