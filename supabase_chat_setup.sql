-- ============================================================
-- FACELOOK CHAT SYSTEM — Complete Supabase Setup
-- Run this entire file once in your Supabase SQL Editor
-- ============================================================

-- ── 1. messages table ────────────────────────────────────────
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references profiles(id) on delete cascade,
  receiver_id  uuid not null references profiles(id) on delete cascade,
  content      text not null default '',
  media_url    text,
  media_type   text,
  reply_to_id  uuid references messages(id) on delete set null,
  reply_preview text,
  seen_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ── If the table already existed, safely add any missing columns ──────────
alter table messages add column if not exists media_url     text;
alter table messages add column if not exists media_type    text;
alter table messages add column if not exists reply_to_id   uuid references messages(id) on delete set null;
alter table messages add column if not exists reply_preview text;
alter table messages add column if not exists seen_at       timestamptz;
-- Make content nullable to allow media-only messages
alter table messages alter column content drop not null;
alter table messages alter column content set default '';

alter table messages enable row level security;

drop policy if exists "Users can read own messages"   on messages;
drop policy if exists "Users can insert own messages" on messages;
drop policy if exists "Users can update own messages" on messages;
drop policy if exists "Users can delete own messages" on messages;

create policy "Users can read own messages"
  on messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can insert own messages"
  on messages for insert
  with check (auth.uid() = sender_id);

create policy "Users can update own messages"
  on messages for update
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can delete own messages"
  on messages for delete
  using (auth.uid() = sender_id);

-- Index for fast conversation queries
create index if not exists messages_sender_receiver_idx
  on messages (sender_id, receiver_id, created_at desc);

create index if not exists messages_receiver_seen_idx
  on messages (receiver_id, seen_at) where seen_at is null;

-- Enable realtime for messages
alter publication supabase_realtime add table messages;


-- ── 2. message_reactions table ───────────────────────────────
create table if not exists message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references messages(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table message_reactions enable row level security;

drop policy if exists "Read reactions" on message_reactions;
drop policy if exists "Insert reactions" on message_reactions;
drop policy if exists "Delete own reactions" on message_reactions;

create policy "Read reactions"
  on message_reactions for select
  using (true);

create policy "Insert reactions"
  on message_reactions for insert
  with check (auth.uid() = user_id);

create policy "Delete own reactions"
  on message_reactions for delete
  using (auth.uid() = user_id);

create index if not exists message_reactions_message_idx
  on message_reactions (message_id);

-- Enable realtime for reactions
alter publication supabase_realtime add table message_reactions;


-- ── 3. user_blocks table ─────────────────────────────────────
create table if not exists user_blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references profiles(id) on delete cascade,
  blocked_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

alter table user_blocks enable row level security;

drop policy if exists "Read own blocks" on user_blocks;
drop policy if exists "Insert own blocks" on user_blocks;
drop policy if exists "Delete own blocks" on user_blocks;

create policy "Read own blocks"
  on user_blocks for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

create policy "Insert own blocks"
  on user_blocks for insert
  with check (auth.uid() = blocker_id);

create policy "Delete own blocks"
  on user_blocks for delete
  using (auth.uid() = blocker_id);


-- ── 4. friendships table ─────────────────────────────────────
create table if not exists friendships (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at  timestamptz not null default now(),
  unique (sender_id, receiver_id)
);

alter table friendships enable row level security;

drop policy if exists "Read own friendships" on friendships;
drop policy if exists "Insert friendship request" on friendships;
drop policy if exists "Update friendship" on friendships;
drop policy if exists "Delete friendship" on friendships;

create policy "Read own friendships"
  on friendships for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Insert friendship request"
  on friendships for insert
  with check (auth.uid() = sender_id);

create policy "Update friendship"
  on friendships for update
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Delete friendship"
  on friendships for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create index if not exists friendships_sender_idx   on friendships (sender_id, status);
create index if not exists friendships_receiver_idx on friendships (receiver_id, status);

-- Enable realtime for friend requests
alter publication supabase_realtime add table friendships;


-- ── 5. stories table (if not already created) ────────────────
create table if not exists stories (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  image_url        text not null,
  caption          text,
  emoji            text,
  mood             text,
  media_type       text default 'image',
  is_help_request  boolean default false,
  music_url        text,
  created_at       timestamptz not null default now()
);

alter table stories enable row level security;

drop policy if exists "Anyone can read stories" on stories;
drop policy if exists "Owner can insert stories" on stories;
drop policy if exists "Owner can delete stories" on stories;

create policy "Anyone can read stories"
  on stories for select using (true);

create policy "Owner can insert stories"
  on stories for insert with check (auth.uid() = user_id);

create policy "Owner can update stories"
  on stories for update using (auth.uid() = user_id);

create policy "Owner can delete stories"
  on stories for delete using (auth.uid() = user_id);

create index if not exists stories_user_created_idx
  on stories (user_id, created_at desc);


-- ── 6. story_views table ─────────────────────────────────────
create table if not exists story_views (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references stories(id) on delete cascade,
  viewer_id  uuid not null references profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  unique (story_id, viewer_id)
);

alter table story_views enable row level security;

drop policy if exists "Story views read" on story_views;
drop policy if exists "Story views insert" on story_views;

create policy "Story views read"
  on story_views for select using (true);

create policy "Story views insert"
  on story_views for insert with check (auth.uid() = viewer_id);


-- ── 7. Verify profiles table has required columns ────────────
alter table profiles
  add column if not exists last_seen timestamptz,
  add column if not exists bio text,
  add column if not exists school text,
  add column if not exists location text,
  add column if not exists account_status text default 'active',
  add column if not exists suspension_reason text;


-- ── Done ─────────────────────────────────────────────────────
-- Run this file once. After running:
-- 1. Enable Realtime for the 'messages' table in Supabase Dashboard
--    → Database → Replication → supabase_realtime → add 'messages'
-- 2. Create a storage bucket named 'chat-images' (public)
--    → Storage → New Bucket → Name: chat-images → Public: ON
-- 3. Set 'chat-images' bucket policy to allow authenticated uploads:
--    → Storage → chat-images → Policies → Add policy:
--      INSERT: (bucket_id = 'chat-images' AND auth.role() = 'authenticated')
--      SELECT: (bucket_id = 'chat-images')
