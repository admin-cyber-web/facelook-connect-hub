-- Comment moderation columns for FameFeed posts
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_by_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hidden_by_name text;

-- Comment moderation columns for Circle posts
ALTER TABLE circle_post_comments
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_by_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hidden_by_name text;
