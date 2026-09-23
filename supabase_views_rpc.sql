-- ══════════════════════════════════════════════════════════════════════
-- Views RPC: atomic post view increment that bypasses RLS
-- Run once in Supabase SQL editor (Dashboard → SQL Editor → Run)
-- ══════════════════════════════════════════════════════════════════════

-- 1. Ensure post_views table exists with correct structure + policies
create table if not exists post_views (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  viewed_at  timestamptz default now()
);

alter table post_views enable row level security;

-- Allow any authenticated user to insert their own view record
drop policy if exists "Auth users can insert post views"  on post_views;
create policy "Auth users can insert post views"
  on post_views for insert
  with check (auth.uid() = user_id or user_id is null);

-- Allow authenticated users to read (for deduplication)
drop policy if exists "Auth users can read post views"   on post_views;
create policy "Auth users can read post views"
  on post_views for select
  using (auth.uid() is not null);

-- Unique index to power upsert deduplication
create unique index if not exists idx_post_views_post_user
  on post_views(post_id, user_id)
  where user_id is not null;

-- 2. Security-definer RPC — increments views_count atomically,
--    bypassing the "Owner update post" RLS restriction.
create or replace function increment_post_views(p_post_id uuid)
returns void
language plpgsql
security definer          -- runs as DB owner, ignores RLS
set search_path = public
as $$
begin
  update posts
  set    views_count = coalesce(views_count, 0) + 1
  where  id = p_post_id;
end;
$$;

-- Grant execute to authenticated and anonymous roles
grant execute on function increment_post_views(uuid) to authenticated;
grant execute on function increment_post_views(uuid) to anon;
