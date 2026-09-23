-- ── Survey Tables ─────────────────────────────────────────────────────────────
-- Run this once in your Supabase SQL Editor

-- 1. surveys
create table if not exists surveys (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  image_url   text,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table surveys enable row level security;
create policy "surveys_select" on surveys for select using (true);
create policy "surveys_insert" on surveys for insert with check (auth.uid() = user_id);
create policy "surveys_delete" on surveys for delete using (auth.uid() = user_id);

-- 2. survey_options
create table if not exists survey_options (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references surveys(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);
alter table survey_options enable row level security;
create policy "survey_options_select" on survey_options for select using (true);
create policy "survey_options_insert" on survey_options for insert with check (
  exists (select 1 from surveys where id = survey_id and user_id = auth.uid())
);

-- 3. votes  (one vote per user per survey enforced by unique constraint)
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references surveys(id) on delete cascade,
  option_id   uuid not null references survey_options(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (survey_id, user_id)
);
alter table votes enable row level security;
create policy "votes_select" on votes for select using (true);
create policy "votes_insert" on votes for insert with check (auth.uid() = user_id);

-- 4. survey_likes
create table if not exists survey_likes (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references surveys(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (survey_id, user_id)
);
alter table survey_likes enable row level security;
create policy "survey_likes_select" on survey_likes for select using (true);
create policy "survey_likes_all"    on survey_likes for all  using (auth.uid() = user_id);

-- 5. survey_comments  (parent_id = null → top-level, else reply)
create table if not exists survey_comments (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references surveys(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  parent_id   uuid references survey_comments(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);
alter table survey_comments enable row level security;
create policy "survey_comments_select" on survey_comments for select using (true);
create policy "survey_comments_insert" on survey_comments for insert with check (auth.uid() = user_id);
create policy "survey_comments_delete" on survey_comments for delete using (auth.uid() = user_id);

-- 6. Storage bucket for survey images  (run separately if bucket doesn't exist)
-- insert into storage.buckets (id, name, public) values ('surveys', 'surveys', true)
-- on conflict do nothing;

-- Indexes for performance
create index if not exists idx_votes_survey     on votes(survey_id);
create index if not exists idx_votes_user       on votes(user_id);
create index if not exists idx_survey_opts      on survey_options(survey_id);
create index if not exists idx_survey_comments  on survey_comments(survey_id);
create index if not exists idx_survey_likes     on survey_likes(survey_id);
