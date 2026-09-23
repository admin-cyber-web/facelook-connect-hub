-- ── Circle Events & RSVPs ──────────────────────────────────────────────────
-- Run this once in Supabase SQL Editor

create table if not exists circle_events (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references circles(id) on delete cascade,
  created_by  uuid not null references profiles(id) on delete cascade,
  title       text not null,
  description text,
  event_date  date not null,
  event_time  time,
  location    text,
  created_at  timestamptz not null default now()
);

create table if not exists circle_event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references circle_events(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  status     text not null check (status in ('going', 'maybe', 'not_going')),
  created_at timestamptz not null default now(),
  unique(event_id, user_id)
);

-- Indexes for fast lookups
create index if not exists circle_events_circle_idx on circle_events(circle_id, event_date asc);
create index if not exists circle_event_rsvps_event_idx on circle_event_rsvps(event_id);
create index if not exists circle_event_rsvps_user_idx  on circle_event_rsvps(user_id);

-- Row Level Security
alter table circle_events      enable row level security;
alter table circle_event_rsvps enable row level security;

-- Drop old policies if re-running
drop policy if exists "circle_events_read"          on circle_events;
drop policy if exists "circle_events_insert_admin"  on circle_events;
drop policy if exists "circle_events_delete_admin"  on circle_events;
drop policy if exists "circle_rsvps_read"           on circle_event_rsvps;
drop policy if exists "circle_rsvps_insert_own"     on circle_event_rsvps;
drop policy if exists "circle_rsvps_update_own"     on circle_event_rsvps;
drop policy if exists "circle_rsvps_delete_own"     on circle_event_rsvps;

-- Events: anyone can read, only creator can insert/delete
create policy "circle_events_read"         on circle_events for select using (true);
create policy "circle_events_insert_admin" on circle_events for insert with check (auth.uid() = created_by);
create policy "circle_events_delete_admin" on circle_events for delete using (auth.uid() = created_by);

-- RSVPs: anyone can read, users manage their own rows
create policy "circle_rsvps_read"       on circle_event_rsvps for select using (true);
create policy "circle_rsvps_insert_own" on circle_event_rsvps for insert with check (auth.uid() = user_id);
create policy "circle_rsvps_update_own" on circle_event_rsvps for update using (auth.uid() = user_id);
create policy "circle_rsvps_delete_own" on circle_event_rsvps for delete using (auth.uid() = user_id);

-- Pinned announcement columns (if not already added from previous migration)
alter table circles add column if not exists pinned_announcement text;
alter table circles add column if not exists pinned_at            timestamptz;

-- Enable realtime for live RSVP updates
do $$
begin
  begin alter publication supabase_realtime add table circle_events;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_event_rsvps; exception when duplicate_object then null; end;
end $$;
