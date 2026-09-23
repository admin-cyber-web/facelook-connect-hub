-- Run in Supabase SQL Editor
-- Adds reply_to_id to messages for swipe-to-reply feature

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;
