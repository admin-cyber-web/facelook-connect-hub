-- Run this in Supabase SQL Editor → New Query
-- Adds seen_at column to messages table for tick/seen functionality

ALTER TABLE messages ADD COLUMN IF NOT EXISTS seen_at timestamptz;

-- Index for fast unseen queries
CREATE INDEX IF NOT EXISTS idx_messages_unseen
  ON messages(receiver_id, seen_at)
  WHERE seen_at IS NULL;

-- Make sure messages table is in realtime publication (for UPDATE events)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
