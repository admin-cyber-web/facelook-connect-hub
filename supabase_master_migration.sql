-- ═══════════════════════════════════════════════════════════════════════════
--  FLICKS INDIA — CORE DATABASE SCHEMA (Run FIRST in new Supabase SQL Editor)
--  Creates all base tables before the migration files are applied.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) PROFILES ─────────────────────────────────────────────────────
create table if not exists profiles (
  id               uuid primary key references auth.users on delete cascade,
  full_name        text,
  username         text unique,
  avatar_url       text,
  bio              text,
  location         text,
  school           text,
  mobile           text,
  fame_points      integer default 0,
  profile_locked   boolean default false,
  profile_hidden   boolean default false,
  is_private_mode  boolean default false,
  last_seen        timestamptz default now(),
  account_status   text not null default 'active',
  suspension_reason text,
  updated_at       timestamptz default now()
);
alter table profiles enable row level security;
create policy "Public read profiles" on profiles for select using (true);
create policy "Owner update profile"  on profiles for update using (auth.uid() = id);
create policy "Owner insert profile"  on profiles for insert with check (auth.uid() = id);

-- 2) POSTS ───────────────────────────────────────────────────────
create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references profiles(id) on delete cascade,
  author        text,
  content       text,
  media_url     text,
  type          text default 'text',
  likes_count   integer default 0,
  comments_count integer default 0,
  views_count   integer default 0,
  shares_count  integer default 0,
  visibility    text default 'public',
  is_admin_post boolean default false,
  metadata      jsonb default '{}',
  cover_url     text,
  created_at    timestamptz default now()
);
alter table posts enable row level security;
create policy "Public read posts"    on posts for select using (true);
create policy "Owner insert post"    on posts for insert with check (auth.uid() = author_id);
create policy "Owner update post"    on posts for update using (auth.uid() = author_id);

-- 3) COMMENTS ────────────────────────────────────────────────────
create table if not exists comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references posts(id) on delete cascade,
  user_id       uuid references profiles(id) on delete cascade,
  author        text,
  content       text not null,
  parent_id     uuid references comments(id) on delete cascade,
  is_hidden     boolean default false,
  hidden_by_id  uuid,
  hidden_by_name text,
  created_at    timestamptz default now()
);
alter table comments enable row level security;
create policy "Public read comments" on comments for select using (true);
create policy "Auth insert comment"  on comments for insert with check (auth.uid() = user_id);
create policy "Owner update comment" on comments for update using (auth.uid() = user_id);
create policy "Owner delete comment" on comments for delete using (auth.uid() = user_id);

-- 4) LIKES ─────────────────────────────────────────────────────────
create table if not exists likes (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid references posts(id) on delete cascade,
  user_id   uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);
alter table likes enable row level security;
create policy "Public read likes" on likes for select using (true);
create policy "Auth insert like"  on likes for insert with check (auth.uid() = user_id);
create policy "Auth delete like"  on likes for delete using (auth.uid() = user_id);

-- 5) SHARES ─────────────────────────────────────────────────────────
create table if not exists shares (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid references posts(id) on delete cascade,
  user_id   uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);
alter table shares enable row level security;
create policy "Public read shares" on shares for select using (true);
create policy "Auth insert share"  on shares for insert with check (auth.uid() = user_id);

-- 6) MESSAGES ───────────────────────────────────────────────────────
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid references profiles(id) on delete cascade,
  receiver_id   uuid references profiles(id) on delete cascade,
  content       text,
  media_url     text,
  media_type    text,
  reply_to_id   uuid references messages(id) on delete set null,
  seen_at       timestamptz,
  created_at    timestamptz default now()
);
alter table messages enable row level security;
create policy "Read own messages" on messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Send message"       on messages for insert with check (auth.uid() = sender_id);

-- 7) GROUPS / CIRCLES ────────────────────────────────────────────────────────
create table if not exists groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  cover_url     text,
  privacy       text default 'public',
  member_count  integer default 0,
  created_at    timestamptz default now()
);
alter table groups enable row level security;
create policy "Public read groups" on groups for select using (true);
create policy "Auth create group"  on groups for insert with check (auth.uid() is not null);

-- 8) CIRCLES ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────0──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN RLS POLICIES — Run once in your Supabase SQL editor
-- Allows admin emails to delete/moderate any post or ban any user.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ensure the likes table has a UNIQUE constraint so upsert works correctly.
--    (Required for "like" persistence — if missing, upsert silently fails)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'likes_post_id_user_id_key'
      AND conrelid = 'likes'::regclass
  ) THEN
    ALTER TABLE likes ADD CONSTRAINT likes_post_id_user_id_key UNIQUE (post_id, user_id);
  END IF;
END $$;

-- 2. Allow admin emails to DELETE any post (bypasses owner-only RLS).
--    posts table uses author_id (NOT user_id) for the post author.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'admin_delete_posts'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_delete_posts" ON posts
      FOR DELETE
      USING (
        auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
        OR auth.uid() = author_id
      );
    $policy$;
  END IF;
END $$;

-- 3. Allow admin emails to UPDATE any post (for future moderation features).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'admin_update_posts'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_update_posts" ON posts
      FOR UPDATE
      USING (
        auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
        OR auth.uid() = author_id
      );
    $policy$;
  END IF;
END $$;

-- 4. Allow ALL authenticated users to DELETE their own posts.
--    posts table: author column is author_id (no user_id column on posts).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'owner_delete_posts'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "owner_delete_posts" ON posts
      FOR DELETE
      USING (
        auth.uid() = author_id
      );
    $policy$;
  END IF;
END $$;
-- ═══════════════════════════════════════════════════════════
-- Flicks Admin & Moderation Setup
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Add account_status and suspension_reason to profiles
alter table public.profiles
  add column if not exists account_status  text    not null default 'active',
  add column if not exists suspension_reason text;

-- 2. Reports table (create if not exists)
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.posts(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now()
);

-- 3. RLS for reports
alter table public.reports enable row level security;

create policy if not exists "Anyone can insert a report"
  on public.reports for insert with check (auth.uid() = reporter_id);

create policy if not exists "Admins can read all reports"
  on public.reports for select using (true);

create policy if not exists "Admins can delete reports"
  on public.reports for delete using (true);

-- 4. Allow admins to update profiles (for suspension)
create policy if not exists "Admins can update any profile"
  on public.profiles for update using (true);

-- 5. Index for faster lookups
create index if not exists idx_profiles_account_status on public.profiles(account_status);
create index if not exists idx_reports_post_id on public.reports(post_id);
-- ── Circle Chat Upgrade: Reply + Media + Reactions ────────────────────────
-- Run this once in Supabase SQL Editor

-- 1. Add reply_to_id and media_url columns to group_messages
alter table group_messages add column if not exists reply_to_id uuid references group_messages(id) on delete set null;
alter table group_messages add column if not exists media_url    text;

-- 2. Group message reactions table
create table if not exists group_message_reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references group_messages(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id)
);

-- Indexes
create index if not exists gmr_message_idx on group_message_reactions(message_id);
create index if not exists gmr_user_idx    on group_message_reactions(user_id);

-- RLS
alter table group_message_reactions enable row level security;

drop policy if exists "gmr_read"        on group_message_reactions;
drop policy if exists "gmr_insert_own"  on group_message_reactions;
drop policy if exists "gmr_update_own"  on group_message_reactions;
drop policy if exists "gmr_delete_own"  on group_message_reactions;

create policy "gmr_read"       on group_message_reactions for select using (true);
create policy "gmr_insert_own" on group_message_reactions for insert with check (auth.uid() = user_id);
create policy "gmr_update_own" on group_message_reactions for update using (auth.uid() = user_id);
create policy "gmr_delete_own" on group_message_reactions for delete using (auth.uid() = user_id);

-- Enable realtime
do $$
begin
  begin alter publication supabase_realtime add table group_message_reactions; exception when duplicate_object then null; end;
end $$;
-- ── Circle Events & RSVPs ──────────────────────────────────────────────────
-- Run this once in Supabase SQL Editor

create table if not exists circle_events (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references circles(id) on delete cascade,
  created_by  uuid not null references profiles(id) on delete cascade,
  title       text not null,
  description text,
  event_date  date not null,
  event_time  time,
  location    text,
  created_at  timestamptz not null default now()
);

create table if not exists circle_event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references circle_events(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  status     text not null check (status in ('going', 'maybe', 'not_going')),
  created_at timestamptz not null default now(),
  unique(event_id, user_id)
);

-- Indexes for fast lookups
create index if not exists circle_events_circle_idx on circle_events(circle_id, event_date asc);
create index if not exists circle_event_rsvps_event_idx on circle_event_rsvps(event_id);
create index if not exists circle_event_rsvps_user_idx  on circle_event_rsvps(user_id);

-- Row Level Security
alter table circle_events      enable row level security;
alter table circle_event_rsvps enable row level security;

-- Drop old policies if re-running
drop policy if exists "circle_events_read"          on circle_events;
drop policy if exists "circle_events_insert_admin"  on circle_events;
drop policy if exists "circle_events_delete_admin"  on circle_events;
drop policy if exists "circle_rsvps_read"           on circle_event_rsvps;
drop policy if exists "circle_rsvps_insert_own"     on circle_event_rsvps;
drop policy if exists "circle_rsvps_update_own"     on circle_event_rsvps;
drop policy if exists "circle_rsvps_delete_own"     on circle_event_rsvps;

-- Events: anyone can read, only creator can insert/delete
create policy "circle_events_read"         on circle_events for select using (true);
create policy "circle_events_insert_admin" on circle_events for insert with check (auth.uid() = created_by);
create policy "circle_events_delete_admin" on circle_events for delete using (auth.uid() = created_by);

-- RSVPs: anyone can read, users manage their own rows
create policy "circle_rsvps_read"       on circle_event_rsvps for select using (true);
create policy "circle_rsvps_insert_own" on circle_event_rsvps for insert with check (auth.uid() = user_id);
create policy "circle_rsvps_update_own" on circle_event_rsvps for update using (auth.uid() = user_id);
create policy "circle_rsvps_delete_own" on circle_event_rsvps for delete using (auth.uid() = user_id);

-- Pinned announcement columns (if not already added from previous migration)
alter table circles add column if not exists pinned_announcement text;
alter table circles add column if not exists pinned_at            timestamptz;

-- Enable realtime for live RSVP updates
do $$
begin
  begin alter publication supabase_realtime add table circle_events;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_event_rsvps; exception when duplicate_object then null; end;
end $$;
alter table if exists circles add column if not exists admin_id uuid;
alter table if exists circles add column if not exists rules text;
alter table if exists circles add column if not exists post_approval boolean default true;
alter table if exists circles add column if not exists member_count integer default 0;

alter table if exists circle_members add column if not exists role text default 'member';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'circle_members_role_check'
  ) then
    alter table circle_members add constraint circle_members_role_check check (role in ('admin', 'moderator', 'member'));
  end if;
end $$;
create unique index if not exists circle_members_circle_user_idx on circle_members(circle_id, user_id);

create table if not exists circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text not null default 'Member',
  author_avatar text,
  content text not null default '',
  media_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  shares_count integer not null default 0,
  comments_muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists circle_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references circle_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists circle_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references circle_posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text not null default 'Member',
  author_avatar text,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  inviter_id uuid not null references profiles(id) on delete cascade,
  invitee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique(circle_id, invitee_id)
);

create index if not exists circle_posts_circle_status_idx on circle_posts(circle_id, status, created_at desc);
create index if not exists circle_post_comments_post_idx on circle_post_comments(post_id, created_at asc);
create index if not exists circle_invites_invitee_idx on circle_invites(invitee_id, status, created_at desc);
create unique index if not exists circle_post_likes_post_user_idx on circle_post_likes(post_id, user_id);

-- Keep denormalized Circle engagement counters authoritative and safe under
-- concurrent likes/comments. Clients mutate only the source rows.
create or replace function public.recount_circle_post_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
begin
  target_post_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  update public.circle_posts
     set likes_count = (
       select count(*)::integer
       from public.circle_post_likes
       where post_id = target_post_id
     )
   where id = target_post_id;
  return null;
end;
$$;

create or replace function public.recount_circle_post_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
begin
  target_post_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  update public.circle_posts
     set comments_count = (
       select count(*)::integer
       from public.circle_post_comments
       where post_id = target_post_id
     )
   where id = target_post_id;
  return null;
end;
$$;

drop trigger if exists trg_circle_post_likes_count on circle_post_likes;
create trigger trg_circle_post_likes_count
after insert or delete on circle_post_likes
for each row execute function public.recount_circle_post_likes();

drop trigger if exists trg_circle_post_comments_count on circle_post_comments;
create trigger trg_circle_post_comments_count
after insert or delete on circle_post_comments
for each row execute function public.recount_circle_post_comments();

update public.circle_posts p
   set likes_count = (
     select count(*)::integer
     from public.circle_post_likes l
     where l.post_id = p.id
   ),
       comments_count = (
     select count(*)::integer
     from public.circle_post_comments c
     where c.post_id = p.id
   );

alter table circle_posts enable row level security;
alter table circle_post_likes enable row level security;
alter table circle_post_comments enable row level security;
alter table circle_invites enable row level security;

drop policy if exists "circle_posts_read" on circle_posts;
drop policy if exists "circle_posts_insert_auth" on circle_posts;
drop policy if exists "circle_posts_update_auth" on circle_posts;
drop policy if exists "circle_posts_delete_auth" on circle_posts;
drop policy if exists "circle_likes_read" on circle_post_likes;
drop policy if exists "circle_likes_insert_own" on circle_post_likes;
drop policy if exists "circle_likes_delete_own" on circle_post_likes;
drop policy if exists "circle_comments_read" on circle_post_comments;
drop policy if exists "circle_comments_insert_own" on circle_post_comments;
drop policy if exists "circle_comments_delete_auth" on circle_post_comments;
drop policy if exists "circle_invites_read_own" on circle_invites;
drop policy if exists "circle_invites_insert_auth" on circle_invites;
drop policy if exists "circle_invites_update_own" on circle_invites;
drop policy if exists "circle_invites_select" on circle_invites;
drop policy if exists "circle_invites_insert" on circle_invites;
drop policy if exists "circle_invites_update" on circle_invites;
drop policy if exists "circle_invites_delete" on circle_invites;

create policy "circle_posts_read" on circle_posts for select using (true);
create policy "circle_posts_insert_auth" on circle_posts for insert with check (auth.uid() = author_id);
create policy "circle_posts_update_auth" on circle_posts for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "circle_posts_delete_auth" on circle_posts for delete using (auth.uid() is not null);

create policy "circle_likes_read" on circle_post_likes for select using (true);
create policy "circle_likes_insert_own" on circle_post_likes for insert with check (auth.uid() = user_id);
create policy "circle_likes_delete_own" on circle_post_likes for delete using (auth.uid() = user_id);

create policy "circle_comments_read" on circle_post_comments for select using (true);
create policy "circle_comments_insert_own" on circle_post_comments for insert with check (auth.uid() = author_id);
create policy "circle_comments_delete_auth" on circle_post_comments for delete using (auth.uid() is not null);

-- circle_invites: any authenticated user can read invites they sent/received,
-- insert/update/delete invites while logged in (app-level guards handle abuse).
create policy "circle_invites_select" on circle_invites
  for select using (auth.uid() is not null);

create policy "circle_invites_insert" on circle_invites
  for insert with check (auth.uid() is not null);

create policy "circle_invites_update" on circle_invites
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "circle_invites_delete" on circle_invites
  for delete using (auth.uid() is not null);

do $$
begin
  begin alter publication supabase_realtime add table circle_posts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_post_likes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_post_comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_invites; exception when duplicate_object then null; end;
end $$;
-- ── Circle Post Views Setup ────────────────────────────────────────────────────
-- Run this once in your Supabase SQL editor to enable Post Reach tracking

-- 1. Create circle_post_views table (tracks unique viewers per post)
create table if not exists circle_post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references circle_posts(id) on delete cascade not null,
  viewer_id uuid references auth.users(id) on delete cascade not null,
  viewed_at timestamptz default now() not null,
  unique(post_id, viewer_id)
);

-- 2. Enable Row Level Security
alter table circle_post_views enable row level security;

-- 3. Allow all authenticated operations (upsert, select)
create policy "allow all for authenticated"
  on circle_post_views
  for all
  using (true)
  with check (true);

-- 4. Index for fast post-level aggregation
create index if not exists idx_circle_post_views_post_id
  on circle_post_views(post_id);

-- 5. Index for fast user-level lookups
create index if not exists idx_circle_post_views_viewer_id
  on circle_post_views(viewer_id);

-- Done! The app will now track and display post reach counts in Circle groups.
-- Admins can tap the 👁 eye icon on any post to see who viewed it.
-- =====================================================================
-- COMMENTS SETUP — Run once in Supabase SQL Editor
-- Fixes: user_id column, insert RLS, comments_count trigger
-- =====================================================================

-- 1. Make sure comments table has all needed columns
--    DB uses user_id (NOT author_id) for the commenter
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_hidden      boolean DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS hidden_by_id   uuid;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS hidden_by_name text;

-- 2. Add comments_count to posts (if not already done)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

-- 3. Trigger function to keep comments_count in sync
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
      SET comments_count = COALESCE(comments_count, 0) + 1
      WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
      SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
      WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 4. Attach trigger to comments table
DROP TRIGGER IF EXISTS trg_post_comments_count ON public.comments;
CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

-- 5. Backfill existing counts
UPDATE public.posts p
SET comments_count = (
  SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id
);

-- =====================================================================
-- RLS POLICIES — Uses user_id (the commenter's auth.uid)
-- =====================================================================

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_all"   ON public.comments;
DROP POLICY IF EXISTS "comments_insert_own"   ON public.comments;
DROP POLICY IF EXISTS "comments_update_own"   ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own"   ON public.comments;
DROP POLICY IF EXISTS "allow all"             ON public.comments;

-- Anyone can read
CREATE POLICY "comments_select_all"
  ON public.comments FOR SELECT USING (true);

-- Logged-in user inserts with their own user_id
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- User can update their own comment
CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);

-- User, post-owner, or admin can delete
CREATE POLICY "comments_delete_own"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT author_id FROM public.posts WHERE id = comments.post_id)
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
        IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );
-- =====================================================
-- COMMENTS TABLE — RLS POLICIES FIX
-- Run this once in Supabase SQL Editor
-- =====================================================

-- 1. Enable RLS on comments table (if not already enabled)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 2. DROP old/broken policies first (safe to run even if they don't exist)
DROP POLICY IF EXISTS "comments_select_all"        ON public.comments;
DROP POLICY IF EXISTS "comments_insert_own"        ON public.comments;
DROP POLICY IF EXISTS "comments_update_own"        ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own"        ON public.comments;
DROP POLICY IF EXISTS "comments_delete_admin"      ON public.comments;
DROP POLICY IF EXISTS "allow all"                  ON public.comments;

-- 3. SELECT: Everyone can read all comments
CREATE POLICY "comments_select_all"
  ON public.comments FOR SELECT
  USING (true);

-- 4. INSERT: Logged-in user can insert their own comment (author_id = auth.uid())
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- 5. UPDATE: User can edit only their own comment
CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  USING (auth.uid() = author_id);

-- 6. DELETE: User can delete their own comment
--            Post owner can also delete comments on their own post
--            Admin emails can delete any comment
CREATE POLICY "comments_delete_own"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = author_id
    OR auth.uid() IN (
      SELECT author_id FROM public.posts WHERE id = comments.post_id
    )
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );

-- =====================================================
-- CIRCLE_POST_COMMENTS TABLE — RLS POLICIES FIX
-- =====================================================

ALTER TABLE public.circle_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "circle_comments_select_all"   ON public.circle_post_comments;
DROP POLICY IF EXISTS "circle_comments_insert_own"   ON public.circle_post_comments;
DROP POLICY IF EXISTS "circle_comments_update_own"   ON public.circle_post_comments;
DROP POLICY IF EXISTS "circle_comments_delete_own"   ON public.circle_post_comments;
DROP POLICY IF EXISTS "allow all"                    ON public.circle_post_comments;

CREATE POLICY "circle_comments_select_all"
  ON public.circle_post_comments FOR SELECT
  USING (true);

CREATE POLICY "circle_comments_insert_own"
  ON public.circle_post_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "circle_comments_update_own"
  ON public.circle_post_comments FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "circle_comments_delete_own"
  ON public.circle_post_comments FOR DELETE
  USING (
    auth.uid() = author_id
    OR auth.uid() IN (
      SELECT author_id FROM public.circle_posts WHERE id = circle_post_comments.post_id
    )
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );

-- =====================================================
-- POSTS TABLE — RLS POLICIES FIX
-- =====================================================

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_all"    ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own"    ON public.posts;
DROP POLICY IF EXISTS "posts_update_own"    ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own"    ON public.posts;
DROP POLICY IF EXISTS "allow all"           ON public.posts;

CREATE POLICY "posts_select_all"
  ON public.posts FOR SELECT
  USING (true);

CREATE POLICY "posts_insert_own"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_update_own"
  ON public.posts FOR UPDATE
  USING (
    auth.uid() = author_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );

CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE
  USING (
    auth.uid() = author_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
  );

-- =====================================================
-- LIKES TABLE — RLS POLICIES FIX (uses user_id column)
-- =====================================================

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_all"   ON public.likes;
DROP POLICY IF EXISTS "likes_insert_own"   ON public.likes;
DROP POLICY IF EXISTS "likes_delete_own"   ON public.likes;
DROP POLICY IF EXISTS "allow all"          ON public.likes;

CREATE POLICY "likes_select_all"
  ON public.likes FOR SELECT
  USING (true);

CREATE POLICY "likes_insert_own"
  ON public.likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete_own"
  ON public.likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "likes_update_own"
  ON public.likes FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- PROFILES TABLE — RLS (basic safety)
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "allow all"             ON public.profiles;

CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
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
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id     uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES profiles(id),
  content     text,
  media_url   text,
  media_type  text DEFAULT '',
  likes_count int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
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
CREATE POLICY "Self update hook_members"    ON hook_members    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Self delete hook_members"    ON hook_members    FOR DELETE USING (auth.uid() = user_id);

-- ── 5. Page Followers (dedicated follow/join table) ────────────────────────────
-- Run these if you haven't already:

-- Add followers_count column to hook_pages (skip if it already exists)
ALTER TABLE hook_pages ADD COLUMN IF NOT EXISTS followers_count int DEFAULT 0;

-- Create page_followers table
CREATE TABLE IF NOT EXISTS page_followers (
  page_id   uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id)   ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (page_id, user_id)
);

ALTER TABLE page_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read page_followers"  ON page_followers FOR SELECT USING (true);
CREATE POLICY "Self insert page_followers"  ON page_followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Self delete page_followers"  ON page_followers FOR DELETE USING (auth.uid() = user_id);

-- Allow hook_pages owners (and followers logic) to update followers_count
CREATE POLICY "Anyone update page followers_count" ON hook_pages FOR UPDATE
  USING (true) WITH CHECK (true);
-- (Tighten this policy in production — scope it to the count field only via a trigger if needed)

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS TABLE  (Facebook-style — full featured)
-- Run this section separately if you already ran the section above.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old simple notifications table if it exists (backs up nothing — all notifs are ephemeral UI)
-- Uncomment the line below ONLY if you want a clean slate:
-- DROP TABLE IF EXISTS notifications;

CREATE TABLE IF NOT EXISTS notifications (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  notifier_id  uuid         REFERENCES profiles(id) ON DELETE CASCADE,  -- who receives this
  actor_id     uuid         REFERENCES profiles(id) ON DELETE CASCADE,  -- who triggered it
  type         text         NOT NULL DEFAULT 'general',
  -- type values: 'like' | 'comment' | 'follow' | 'friend_request' | 'friend_accepted'
  --              | 'circle_join' | 'new_post' | 'mention' | 'general'
  entity_id    uuid,        -- optional: post id, page id, circle id, etc.
  entity_type  text,        -- optional: 'post' | 'page' | 'circle'
  content      text,        -- human-readable message (e.g. "Rahul ne like kiya")
  is_read      boolean      NOT NULL DEFAULT false,
  created_at   timestamptz  DEFAULT now()
);

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_notifications_notifier_id ON notifications(notifier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id    ON notifications(actor_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "notif_select_own" ON notifications
  FOR SELECT USING (auth.uid() = notifier_id);

CREATE POLICY "notif_insert_auth" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = notifier_id);

CREATE POLICY "notif_delete_own" ON notifications
  FOR DELETE USING (auth.uid() = notifier_id);

-- Enable Realtime for instant bell icon updates
-- (Run in Supabase Dashboard → Database → Replication → Add table)
-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Auto-create notification when a friend request is sent
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  sender_name text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT full_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
    INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
    VALUES (
      NEW.receiver_id,
      NEW.sender_id,
      'friend_request',
      NEW.id,
      'friendship',
      COALESCE(sender_name, 'Kisi ne') || ' ne aapko friend request bheji'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_request ON friendships;
CREATE TRIGGER trg_notify_friend_request
  AFTER INSERT ON friendships
  FOR EACH ROW EXECUTE FUNCTION notify_friend_request();

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Auto-create notification when friend request is accepted
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_friend_accepted()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  acceptor_name text;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT full_name INTO acceptor_name FROM profiles WHERE id = NEW.receiver_id;
    INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
    VALUES (
      NEW.sender_id,
      NEW.receiver_id,
      'friend_accepted',
      NEW.id,
      'friendship',
      COALESCE(acceptor_name, 'Kisi ne') || ' ne aapki friend request accept ki'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_accepted ON friendships;
CREATE TRIGGER trg_notify_friend_accepted
  AFTER UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION notify_friend_accepted();
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
-- Run this in Supabase SQL Editor → New Query
-- Adds seen_at column to messages table for tick/seen functionality

ALTER TABLE messages ADD COLUMN IF NOT EXISTS seen_at timestamptz;

-- Index for fast unseen queries
CREATE INDEX IF NOT EXISTS idx_messages_unseen
  ON messages(receiver_id, seen_at)
  WHERE seen_at IS NULL;

-- Make sure messages table is in realtime publication (for UPDATE events)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ═══════════════════════════════════════════════════════════
-- Flicks Moderation: User-level reports + blocks
-- Safe to run multiple times (idempotent).
-- Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

-- 1. Allow reports to be filed against a USER (not just a post).
--    target_id = the profile being reported. post_id stays for post reports.
alter table public.reports
  add column if not exists target_id uuid references auth.users(id) on delete cascade;

-- post_id was NOT NULL in some installs — relax it so user-only reports work.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'reports'
      and column_name  = 'post_id'
      and is_nullable  = 'NO'
  ) then
    execute 'alter table public.reports alter column post_id drop not null';
  end if;
end $$;

create index if not exists idx_reports_target_id on public.reports(target_id);

-- 2. user_blocks table — blocker_id blocks blocked_id.
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists idx_user_blocks_blocked_id on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

create policy if not exists "Users can read their own blocks"
  on public.user_blocks for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

create policy if not exists "Users can block others"
  on public.user_blocks for insert
  with check (auth.uid() = blocker_id);

create policy if not exists "Users can unblock others"
  on public.user_blocks for delete
  using (auth.uid() = blocker_id);
-- ═══════════════════════════════════════════════════════════════════════════
--  FLICKS INDIA — PRIVACY SYSTEM SCHEMA (Run once in Supabase SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) profiles: add is_private_mode + last_seen
alter table profiles
  add column if not exists is_private_mode boolean default false,
  add column if not exists last_seen timestamptz default now();

comment on column profiles.is_private_mode is 'When true, only accepted friends can view timeline/interact.';
comment on column profiles.last_seen is 'Updated on every user activity heartbeat for green-dot online status.';

-- 2) posts: add visibility column
alter table posts
  add column if not exists visibility text default 'public';

comment on column posts.visibility is 'public = visible to everyone; friends_only = visible only to accepted friends.';

-- 3) Ensure friendships table exists (if not already present)
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  status text default 'pending', -- 'pending' | 'accepted'
  created_at timestamptz default now(),
  unique (sender_id, receiver_id)
);
alter table friendships enable row level security;

-- Allow users to read their own friendships
create policy if not exists "Users can view own friendships"
  on friendships for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Allow users to insert their own requests
create policy if not exists "Users can send friend requests"
  on friendships for insert
  with check (auth.uid() = sender_id);

-- Allow either party to update status (accept / reject)
create policy if not exists "Users can update own friendships"
  on friendships for update
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- 4) Add a lightweight function to update last_seen (can be called from client)
create or replace function update_last_seen(user_uuid uuid)
returns void
language plpgsql
security definer
as $$
begin
  update profiles set last_seen = now() where id = user_uuid;
end;
$$;

-- 5) Create an index for fast feed filtering by visibility
create index if not exists idx_posts_visibility on posts(visibility);
create index if not exists idx_posts_author_visibility on posts(author_id, visibility);

-- 6) Grant execute on the function to authenticated users
grant execute on function update_last_seen(uuid) to authenticated;
-- ═══════════════════════════════════════════════════════════
-- Flicks: Message & Comment Reactions Setup
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. message_reactions table
create table if not exists public.message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.message_reactions enable row level security;

create policy if not exists "Users can read message reactions"
  on public.message_reactions for select using (true);

create policy if not exists "Users can insert own message reactions"
  on public.message_reactions for insert with check (auth.uid() = user_id);

create policy if not exists "Users can update own message reactions"
  on public.message_reactions for update using (auth.uid() = user_id);

create policy if not exists "Users can delete own message reactions"
  on public.message_reactions for delete using (auth.uid() = user_id);

-- 2. comment_reactions table
create table if not exists public.comment_reactions (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (comment_id, user_id)
);

alter table public.comment_reactions enable row level security;

create policy if not exists "Users can read comment reactions"
  on public.comment_reactions for select using (true);

create policy if not exists "Users can insert own comment reactions"
  on public.comment_reactions for insert with check (auth.uid() = user_id);

create policy if not exists "Users can update own comment reactions"
  on public.comment_reactions for update using (auth.uid() = user_id);

create policy if not exists "Users can delete own comment reactions"
  on public.comment_reactions for delete using (auth.uid() = user_id);

-- 3. Enable realtime for both tables
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.comment_reactions;
-- Run in Supabase SQL Editor
-- Adds reply_to_id to messages for swipe-to-reply feature

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;
-- ═══════════════════════════════════════════════════════════════════
--  Flicks — Stories & Story Views schema (v2)
--  Run this in Supabase SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Create / extend stories table ────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url        text NOT NULL,
  caption          text,
  emoji            text,
  -- v2 columns (add if upgrading from v1)
  mood             text,            -- 'happy' | 'sad' | 'love' | 'angry' | 'party' | 'chill'
  media_type       text,            -- 'image' | 'voice'
  is_help_request  boolean DEFAULT false,
  music_url        text,            -- background music auto-played during viewing
  created_at       timestamptz DEFAULT now()
);

-- Add v2 columns to existing table (safe — no-ops if already present)
ALTER TABLE stories ADD COLUMN IF NOT EXISTS mood            text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS media_type      text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_help_request boolean DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS music_url       text;

-- ── 2. Enable RLS ────────────────────────────────────────────────────
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- ── 3. RLS Policies ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Public read stories'
  ) THEN
    CREATE POLICY "Public read stories"
      ON stories FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Owner insert stories'
  ) THEN
    CREATE POLICY "Owner insert stories"
      ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Owner delete stories'
  ) THEN
    CREATE POLICY "Owner delete stories"
      ON stories FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user_id    ON stories(user_id);

-- ── 5. story_views table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_views (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   uuid REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id  uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at  timestamptz DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_views' AND policyname = 'Owner reads own story views'
  ) THEN
    CREATE POLICY "Owner reads own story views"
      ON story_views FOR SELECT
      USING (
        viewer_id = auth.uid()
        OR story_id IN (SELECT id FROM stories WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_views' AND policyname = 'Auth insert story view'
  ) THEN
    CREATE POLICY "Auth insert story view"
      ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_story_views_story_id  ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON story_views(viewer_id);

-- ── 6. Enable Realtime ───────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE stories;

-- ── 7. Storage bucket note ───────────────────────────────────────────
-- Ensure the "avatars" bucket is public and allows authenticated uploads:
-- Dashboard → Storage → avatars → Policies
-- Policy: allow authenticated INSERT/SELECT to any path
-- Done!
-- Run this once in your Supabase SQL editor to enable Story Comments

create table if not exists story_comments (
  id          uuid primary key default gen_random_uuid(),
  story_id    text not null,
  user_id     uuid references auth.users(id) on delete cascade,
  content     text not null check (char_length(content) <= 500),
  created_at  timestamptz default now()
);

create index if not exists story_comments_story_id_idx on story_comments(story_id);
create index if not exists story_comments_user_id_idx  on story_comments(user_id);

alter table story_comments enable row level security;

-- Anyone can read comments
create policy "story_comments_select" on story_comments
  for select using (true);

-- Authenticated users can insert their own comments
create policy "story_comments_insert" on story_comments
  for insert with check (auth.uid() = user_id);

-- Users can delete their own comments
create policy "story_comments_delete" on story_comments
  for delete using (auth.uid() = user_id);
-- ═══════════════════════════════════════════════════════════════════
--  Flicks — Story Likes schema (WhatsApp-style)
--  Run this in Supabase SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS story_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   uuid REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (story_id, user_id)
);

ALTER TABLE story_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_likes' AND policyname = 'Public read story likes'
  ) THEN
    CREATE POLICY "Public read story likes"
      ON story_likes FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_likes' AND policyname = 'Auth insert story like'
  ) THEN
    CREATE POLICY "Auth insert story like"
      ON story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_likes' AND policyname = 'Owner delete own story like'
  ) THEN
    CREATE POLICY "Owner delete own story like"
      ON story_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user_id  ON story_likes(user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE story_likes;
\n-- ═══════════════════════════════════════════════════════════════════════════\n-- GAME SESSIONS (KBC Quiz Battle)\n-- ═══════════════════════════════════════════════════════════════════════════\n\ncreate table if not exists game_sessions (\n  id uuid primary key default gen_random_uuid(),\n  host_id uuid references profiles(id),\n  guest_id uuid references profiles(id),\n  status text default 'waiting',\n  host_score int default 0,\n  guest_score int default 0,\n  current_round int default 1,\n  movie_indices int[] default '{}',\n  winner_id uuid references profiles(id),\n  created_at timestamptz default now()\n);\n\nalter table game_sessions enable row level security;\ncreate policy "allow all" on game_sessions for all using (true);\n\n-- ═══════════════════════════════════════════════════════════════════════════\n-- ADMIN EARNINGS\n-- ═══════════════════════════════════════════════════════════════════════════\n\ncreate table if not exists admin_earnings (\n  id uuid primary key default gen_random_uuid(),\n  session_id uuid,\n  amount int,\n  reason text,\n  created_at timestamptz default now()\n);\n\nalter table admin_earnings enable row level security;\ncreate policy "allow all" on admin_earnings for all using (true);
\n-- ═══════════════════════════════════════════════════════════════════════════\n-- CIRCLES & CIRCLE_MEMBERS (Social Group / Community)\n-- ═══════════════════════════════════════════════════════════════════════════\n\ncreate table if not exists circles (\n  id            uuid primary key default gen_random_uuid(),\n  name          text not null,\n  description   text,\n  cover_url     text,\n  admin_id      uuid references profiles(id) on delete cascade,\n  privacy       text default 'public',\n  post_approval boolean default true,\n  rules         text,\n  member_count  integer default 0,\n  pinned_announcement text,\n  pinned_at     timestamptz,\n  created_at    timestamptz default now()\n);\n\nalter table circles enable row level security;\ncreate policy "Public read circles" on circles for select using (true);\ncreate policy "Auth create circle" on circles for insert with check (auth.uid() is not null);\n\ncreate table if not exists circle_members (\n  id         uuid primary key default gen_random_uuid(),\n  circle_id  uuid references circles(id) on delete cascade,\n  user_id    uuid references profiles(id) on delete cascade,\n  role       text default 'member',\n  joined_at  timestamptz default now(),\n  unique (circle_id, user_id)\n);\n\nalter table circle_members enable row level security;\ncreate policy "Public read circle members" on circle_members for select using (true);\ncreate policy "Auth join circle" on circle_members for insert with check (auth.uid() = user_id);
\n-- ═══════════════════════════════════════════════════════════════════════════\n-- GROUP_MESSAGES (for messenger groups)\n-- ═══════════════════════════════════════════════════════════════════════════\n\ncreate table if not exists group_messages (\n  id         uuid primary key default gen_random_uuid(),\n  group_id   uuid references groups(id) on delete cascade,\n  sender_id  uuid references profiles(id) on delete cascade,\n  content    text,\n  media_url  text,\n  media_type text,\n  reply_to_id uuid references group_messages(id) on delete set null,\n  created_at timestamptz default now()\n);\n\nalter table group_messages enable row level security;\ncreate policy "Group members read messages" on group_messages for select using (auth.uid() is not null);\ncreate policy "Group members send" on group_messages for insert with check (auth.uid() = sender_id);

-- ── User Tasks (TaskBoard) ─────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor to enable the Task tab.
create table if not exists user_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null,
  description text,
  priority    text not null default 'medium',
  is_done     boolean not null default false,
  due_date    date,
  created_at  timestamptz not null default now()
);
alter table user_tasks enable row level security;
create policy "own tasks" on user_tasks for all using (auth.uid() = user_id);
create index if not exists idx_user_tasks_user_id on user_tasks(user_id);
create index if not exists idx_user_tasks_is_done on user_tasks(is_done);
