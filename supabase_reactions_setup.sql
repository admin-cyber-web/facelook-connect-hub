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
