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
