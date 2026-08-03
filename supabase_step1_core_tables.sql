-- ═══════════════════════════════════════════════════════════════════════════
--  STEP 1 — CORE TABLES (Run FIRST in new Supabase SQL Editor)
--  profiles → posts → comments → likes → shares → messages → groups
--  ═══════════════════════════════════════════════════════════════════════════

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
  likes_count   integer default 0,
  is_hidden     boolean default false,
  hidden_by_id  uuid references profiles(id) on delete set null,
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
  unique(post_id, user_id)
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
  created_at timestamptz default now(),
  unique(post_id, user_id)
);
alter table shares enable row level security;
create policy "Public read shares" on shares for select using (true);
create policy "Auth insert share"  on shares for insert with check (auth.uid() = user_id);

-- 6) MESSAGES ───────────────────────────────────────────────────────
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  content     text not null,
  media_url   text,
  read        boolean default false,
  created_at  timestamptz default now()
);
alter table messages enable row level security;
create policy "Read own messages" on messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Send message"       on messages for insert with check (auth.uid() = sender_id);

-- 7) GROUPS / CIRCLES ────────────────────────────────────────────────────────
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  avatar_url  text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz default now()
);
alter table groups enable row level security;
create policy "Public read groups" on groups for select using (true);
create policy "Auth create group"  on groups for insert with check (auth.uid() is not null);

-- group_members
create table if not exists group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid references groups(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  role       text default 'member',
  joined_at  timestamptz default now(),
  unique(group_id, user_id)
);

-- group_messages
create table if not exists group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid references groups(id) on delete cascade,
  sender_id  uuid references profiles(id) on delete cascade,
  content    text not null,
  media_url  text,
  reply_to_id uuid references group_messages(id) on delete set null,
  created_at timestamptz default now()
);
