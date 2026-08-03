-- ═══════════════════════════════════════════════════════════════════════════
--  REPORTS TABLE INTEGRITY — auto-fill reported_user_id + safe defaults
--  Safe to run multiple times (idempotent). Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Make sure the columns this trigger depends on actually exist.
alter table public.reports
  add column if not exists reported_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text not null default 'pending',
  add column if not exists decision text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_reports_reported_user_id on public.reports(reported_user_id);
create index if not exists idx_reports_status on public.reports(status);

-- 2. Trigger function — runs BEFORE INSERT so it can fill in NEW.* before the row lands.
create or replace function public.ensure_report_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Auto-populate reported_user_id from target_id (user-level report) when missing.
  if new.reported_user_id is null and new.target_id is not null then
    new.reported_user_id := new.target_id;
  end if;

  -- Fallback: derive reported_user_id from the reported post's author when still missing.
  if new.reported_user_id is null and new.post_id is not null then
    select author_id into new.reported_user_id
    from public.posts
    where id = new.post_id;
  end if;

  -- Every report must have a sensible status.
  if new.status is null or btrim(new.status) = '' then
    new.status := 'pending';
  end if;

  -- Every report must have a created_at timestamp.
  if new.created_at is null then
    new.created_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ensure_report_integrity on public.reports;
create trigger trg_ensure_report_integrity
  before insert on public.reports
  for each row
  execute function public.ensure_report_integrity();

-- ═══════════════════════════════════════════════════════════════════════════
--  VERIFICATION — run after the above to confirm no report is left incomplete
-- ═══════════════════════════════════════════════════════════════════════════
/*
select id, post_id, target_id, reported_user_id, status, created_at
from public.reports
where reported_user_id is null or status is null or created_at is null
order by created_at desc;
*/
