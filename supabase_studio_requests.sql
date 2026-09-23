-- ── Creator Studio: Name Change Requests + Creator Profile Fields ─────────────
-- Run this once in your Supabase SQL editor (after supabase_creator_studio.sql).

-- 1. Add editable creator profile fields to profiles
alter table public.profiles
  add column if not exists creator_email    text,
  add column if not exists creator_mobile   text,
  add column if not exists creator_city     text,
  add column if not exists creator_address  text,
  add column if not exists creator_pin      text,
  add column if not exists creator_category text;

-- 2. Name change requests table
create table if not exists public.name_change_requests (
  id               uuid        primary key default gen_random_uuid(),
  profile_id       uuid        not null references public.profiles(id) on delete cascade,
  current_name     text,
  requested_name   text        not null,
  reason           text,
  status           text        not null default 'pending',  -- pending | approved | rejected
  created_at       timestamptz not null default now()
);

alter table public.name_change_requests enable row level security;

-- Users can insert their own requests
create policy if not exists "users can insert own name requests"
  on public.name_change_requests for insert
  with check (auth.uid() = profile_id);

-- Users can view their own requests
create policy if not exists "users can view own name requests"
  on public.name_change_requests for select
  using (auth.uid() = profile_id);

-- Admins can view all requests
create policy if not exists "admins can view all name requests"
  on public.name_change_requests for select
  using (true);

-- Admins can update (approve/reject) requests
create policy if not exists "admins can update name requests"
  on public.name_change_requests for update
  using (true);

-- Index for fast admin queries
create index if not exists idx_name_change_requests_status
  on public.name_change_requests (status, created_at desc);

create index if not exists idx_name_change_requests_profile
  on public.name_change_requests (profile_id);
