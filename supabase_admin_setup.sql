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
