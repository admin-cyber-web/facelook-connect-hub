-- Run this in your Supabase SQL Editor → New Query

-- 1. Hook Pages (like Facebook Pages)
CREATE TABLE IF NOT EXISTS hook_pages (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  category      text DEFAULT 'General',
  cover_url     text,
  avatar_url    text,
  follower_count int  DEFAULT 0,
  hook_count    int  DEFAULT 0,
  post_count    int  DEFAULT 0,
  like_count    int  DEFAULT 0,
  is_monetized  boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- 2. Posts on Hook Pages
CREATE TABLE IF NOT EXISTS hook_page_posts (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id    uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES profiles(id),
  content    text,
  media_url  text,
  likes_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Hook Invites (who invited whom to which page)
CREATE TABLE IF NOT EXISTS hook_invites (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id     uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  inviter_id  uuid REFERENCES profiles(id),
  invitee_id  uuid REFERENCES profiles(id),
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(page_id, invitee_id)
);

-- 4. Hook Page Members
CREATE TABLE IF NOT EXISTS hook_members (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id   uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(page_id, user_id)
);

-- Enable RLS (Row Level Security)
ALTER TABLE hook_pages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_page_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_invites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_members    ENABLE ROW LEVEL SECURITY;

-- Open read/write policies (adjust as needed)
CREATE POLICY "Public read hook_pages"      ON hook_pages      FOR SELECT USING (true);
CREATE POLICY "Owner insert hook_pages"     ON hook_pages      FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner update hook_pages"     ON hook_pages      FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner delete hook_pages"     ON hook_pages      FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Public read hook_page_posts" ON hook_page_posts FOR SELECT USING (true);
CREATE POLICY "Author insert hook_posts"    ON hook_page_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author delete hook_posts"    ON hook_page_posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Public read hook_invites"    ON hook_invites    FOR SELECT USING (true);
CREATE POLICY "Inviter insert hook_invites" ON hook_invites    FOR INSERT WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "Update hook_invites"         ON hook_invites    FOR UPDATE USING (true);

CREATE POLICY "Public read hook_members"    ON hook_members    FOR SELECT USING (true);
CREATE POLICY "Self insert hook_members"    ON hook_members    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Self delete hook_members"    ON hook_members    FOR DELETE USING (auth.uid() = user_id);
