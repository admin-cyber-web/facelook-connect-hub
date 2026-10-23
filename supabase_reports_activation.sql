-- Report submission schema and authenticated insert policy.
-- Safe to rerun. Apply in the Supabase SQL Editor if reports are failing
-- because the deployed table is missing columns expected by the app.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.reports
  add column if not exists reporter_id uuid references auth.users(id) on delete cascade,
  add column if not exists post_id uuid references public.posts(id) on delete cascade,
  add column if not exists target_id uuid references auth.users(id) on delete cascade,
  add column if not exists reported_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists type text not null default 'post',
  add column if not exists reason text not null default 'Unspecified',
  add column if not exists status text not null default 'pending',
  add column if not exists decision text,
  add column if not exists token_number text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_reports_status_created_at
  on public.reports (status, created_at desc);

alter table public.reports enable row level security;
grant insert on public.reports to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reports'
      and policyname = 'reports_insert_own'
  ) then
    create policy reports_insert_own
      on public.reports
      for insert
      to authenticated
      with check (auth.uid() = reporter_id);
  end if;
end;
$$;
