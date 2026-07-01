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
