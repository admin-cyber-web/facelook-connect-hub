-- ═══════════════════════════════════════════════════════════════
--  MAGNET INVITES TABLE — Run in Supabase SQL editor
--  Tracks who INVITED whom before they accept/join the chain
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS magnet_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id, post_id)
);

CREATE INDEX IF NOT EXISTS magnet_invites_sender_idx   ON magnet_invites(sender_id);
CREATE INDEX IF NOT EXISTS magnet_invites_receiver_idx ON magnet_invites(receiver_id);
CREATE INDEX IF NOT EXISTS magnet_invites_post_idx     ON magnet_invites(post_id);

-- RLS
ALTER TABLE magnet_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "magnet_invites_select" ON magnet_invites;
DROP POLICY IF EXISTS "magnet_invites_insert" ON magnet_invites;
DROP POLICY IF EXISTS "magnet_invites_delete" ON magnet_invites;

CREATE POLICY "magnet_invites_select" ON magnet_invites FOR SELECT USING (true);
CREATE POLICY "magnet_invites_insert" ON magnet_invites FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "magnet_invites_delete" ON magnet_invites FOR DELETE USING (auth.uid() = sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE magnet_invites;

-- ── Also fix magnet_chains RLS to allow reading with invited_by filter ────────
-- Drop any over-restrictive existing policies and re-create open read:
DROP POLICY IF EXISTS "magnet_chains_select" ON magnet_chains;
CREATE POLICY "magnet_chains_select" ON magnet_chains FOR SELECT USING (true);

DROP POLICY IF EXISTS "magnet_chains_insert" ON magnet_chains;
CREATE POLICY "magnet_chains_insert" ON magnet_chains FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "magnet_chains_update" ON magnet_chains;
CREATE POLICY "magnet_chains_update" ON magnet_chains FOR UPDATE USING (
  auth.uid() = user_id OR
  auth.uid() IN (SELECT author_id FROM posts WHERE id::text = post_id)
);

-- ── is_guest column for profiles (for guest mode) ─────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;
