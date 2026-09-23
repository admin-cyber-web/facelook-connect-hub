-- ═══════════════════════════════════════════════════════════════════════════
--  STEP 4 — STORIES, REACTIONS, GAME TABLES (Run AFTER Steps 1-3)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. STORIES + VIEWS + LIKES + COMMENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url        text NOT NULL,
  caption          text,
  emoji            text,
  mood             text,
  media_type       text,
  is_help_request  boolean DEFAULT false,
  music_url        text,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE stories ADD COLUMN IF NOT EXISTS mood text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_help_request boolean DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS music_url text;

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Public read stories')
    THEN CREATE POLICY "Public read stories" ON stories FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Owner insert stories')
    THEN CREATE POLICY "Owner insert stories" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Owner delete stories')
    THEN CREATE POLICY "Owner delete stories" ON stories FOR DELETE USING (auth.uid() = user_id); END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user_id    ON stories(user_id);

CREATE TABLE IF NOT EXISTS story_views (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   uuid REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id  uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at  timestamptz DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_views' AND policyname = 'Owner reads own story views')
    THEN CREATE POLICY "Owner reads own story views" ON story_views FOR SELECT
    USING (viewer_id = auth.uid() OR story_id IN (SELECT id FROM stories WHERE user_id = auth.uid())); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_views' AND policyname = 'Auth insert story view')
    THEN CREATE POLICY "Auth insert story view" ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id); END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_story_views_story_id  ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON story_views(viewer_id);

CREATE TABLE IF NOT EXISTS story_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   uuid REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (story_id, user_id)
);
ALTER TABLE story_likes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_likes' AND policyname = 'Public read story likes')
    THEN CREATE POLICY "Public read story likes" ON story_likes FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_likes' AND policyname = 'Auth insert story like')
    THEN CREATE POLICY "Auth insert story like" ON story_likes FOR INSERT WITH CHECK (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_likes' AND policyname = 'Owner delete own story like')
    THEN CREATE POLICY "Owner delete own story like" ON story_likes FOR DELETE USING (auth.uid() = user_id); END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user_id  ON story_likes(user_id);

CREATE TABLE IF NOT EXISTS story_comments (
  id          uuid primary key default gen_random_uuid(),
  story_id    text not null,
  user_id     uuid references auth.users(id) on delete cascade,
  content     text not null check (char_length(content) <= 500),
  created_at  timestamptz default now()
);
CREATE INDEX IF NOT EXISTS story_comments_story_id_idx ON story_comments(story_id);
CREATE INDEX IF NOT EXISTS story_comments_user_id_idx  ON story_comments(user_id);
ALTER TABLE story_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_comments_select" ON story_comments FOR SELECT USING (true);
CREATE POLICY "story_comments_insert" ON story_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "story_comments_delete" ON story_comments FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE stories;
ALTER PUBLICATION supabase_realtime ADD TABLE story_likes;

-- ── 2. MESSAGE & COMMENT REACTIONS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (message_id, user_id)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read message reactions"     ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert own message reactions" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own message reactions"   ON public.message_reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own message reactions"   ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (comment_id, user_id)
);
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read comment reactions"     ON public.comment_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert own comment reactions" ON public.comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comment reactions"   ON public.comment_reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comment reactions"   ON public.comment_reactions FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reactions;

-- Group message reactions
create table if not exists group_message_reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references group_messages(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id)
);
create index if not exists gmr_message_idx on group_message_reactions(message_id);
create index if not exists gmr_user_idx    on group_message_reactions(user_id);
alter table group_message_reactions enable row level security;
drop policy if exists "gmr_read"       on group_message_reactions;
drop policy if exists "gmr_insert_own" on group_message_reactions;
drop policy if exists "gmr_update_own" on group_message_reactions;
drop policy if exists "gmr_delete_own" on group_message_reactions;
create policy "gmr_read"       on group_message_reactions for select using (true);
create policy "gmr_insert_own" on group_message_reactions for insert with check (auth.uid() = user_id);
create policy "gmr_update_own" on group_message_reactions for update using (auth.uid() = user_id);
create policy "gmr_delete_own" on group_message_reactions for delete using (auth.uid() = user_id);
do $$ begin
  begin alter publication supabase_realtime add table group_message_reactions; exception when duplicate_object then null; end;
end $$;

-- ── 3. KBC QUIZ (Game Sessions + Admin Earnings) ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references profiles(id),
  guest_id uuid references profiles(id),
  status text default 'waiting',
  host_score int default 0,
  guest_score int default 0,
  current_round int default 1,
  movie_indices int[] default '{}',
  winner_id uuid references profiles(id),
  created_at timestamptz default now()
);
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON game_sessions FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS admin_earnings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  amount int,
  reason text,
  created_at timestamptz default now()
);
ALTER TABLE admin_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON admin_earnings FOR ALL USING (true);
