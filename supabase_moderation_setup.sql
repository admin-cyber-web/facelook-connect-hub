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
