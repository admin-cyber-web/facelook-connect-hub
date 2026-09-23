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
