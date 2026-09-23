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
