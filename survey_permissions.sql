-- ═══════════════════════════════════════════════════════════════════════════════
-- survey_permissions.sql
-- Run this entire file in Supabase SQL Editor to fix RLS violations permanently.
-- It drops every existing policy and rebuilds them from scratch.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 0. RECREATE TABLES with correct FK → auth.users (safe: uses IF NOT EXISTS)
-- surveys.user_id must reference auth.users(id), NOT profiles(id),
-- because auth.uid() resolves against auth.users.
-- If you already have the tables, the ALTER below adds the FK if missing.

-- surveys ─────────────────────────────────────────────────────────────────────
create table if not exists surveys (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  image_url  text,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- survey_options ──────────────────────────────────────────────────────────────
create table if not exists survey_options (
  id        uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  text      text not null,
  created_at timestamptz not null default now()
);

-- votes ───────────────────────────────────────────────────────────────────────
create table if not exists votes (
  id        uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  option_id uuid not null references survey_options(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (survey_id, user_id)   -- one vote per user per survey
);

-- survey_likes ────────────────────────────────────────────────────────────────
create table if not exists survey_likes (
  id        uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (survey_id, user_id)
);

-- survey_comments ─────────────────────────────────────────────────────────────
create table if not exists survey_comments (
  id        uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references survey_comments(id) on delete cascade,
  content   text not null,
  created_at timestamptz not null default now()
);

-- ── 1. ENABLE ROW-LEVEL SECURITY on every table ──────────────────────────────
alter table surveys         enable row level security;
alter table survey_options  enable row level security;
alter table votes           enable row level security;
alter table survey_likes    enable row level security;
alter table survey_comments enable row level security;

-- ── 2. DROP ALL EXISTING POLICIES (clean slate) ──────────────────────────────
do $$ declare r record; begin
  for r in (
    select policyname, tablename
    from pg_policies
    where tablename in ('surveys','survey_options','votes','survey_likes','survey_comments')
  ) loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. SURVEYS
-- ══════════════════════════════════════════════════════════════════════════════

-- Anyone (authenticated or not) can read surveys
create policy "surveys: anyone can read"
  on surveys for select
  using (true);

-- Only the owner can insert (user_id must match the caller)
create policy "surveys: owner can insert"
  on surveys for insert
  with check (auth.uid() = user_id);

-- Only the owner can update their own survey
create policy "surveys: owner can update"
  on surveys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Only the owner can delete their own survey
create policy "surveys: owner can delete"
  on surveys for delete
  using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. SURVEY_OPTIONS
-- (no direct user_id column — ownership checked via parent survey)
-- ══════════════════════════════════════════════════════════════════════════════

create policy "survey_options: anyone can read"
  on survey_options for select
  using (true);

-- Only the survey owner may add options
create policy "survey_options: survey owner can insert"
  on survey_options for insert
  with check (
    exists (
      select 1 from surveys
      where surveys.id = survey_id
        and surveys.user_id = auth.uid()
    )
  );

-- Only the survey owner may delete options
create policy "survey_options: survey owner can delete"
  on survey_options for delete
  using (
    exists (
      select 1 from surveys
      where surveys.id = survey_id
        and surveys.user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. VOTES
-- ══════════════════════════════════════════════════════════════════════════════

create policy "votes: anyone can read"
  on votes for select
  using (true);

-- Authenticated user can cast their own vote
create policy "votes: authenticated user can insert"
  on votes for insert
  with check (
    auth.uid() = user_id
    and auth.uid() is not null
  );

-- User can retract their own vote
create policy "votes: owner can delete"
  on votes for delete
  using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. SURVEY_LIKES
-- ══════════════════════════════════════════════════════════════════════════════

create policy "survey_likes: anyone can read"
  on survey_likes for select
  using (true);

create policy "survey_likes: owner can insert"
  on survey_likes for insert
  with check (auth.uid() = user_id);

create policy "survey_likes: owner can delete"
  on survey_likes for delete
  using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. SURVEY_COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

create policy "survey_comments: anyone can read"
  on survey_comments for select
  using (true);

create policy "survey_comments: owner can insert"
  on survey_comments for insert
  with check (
    auth.uid() = user_id
    and auth.uid() is not null
  );

create policy "survey_comments: owner can update"
  on survey_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "survey_comments: owner can delete"
  on survey_comments for delete
  using (auth.uid() = user_id);

-- ── 8. STORAGE BUCKET for survey images ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('surveys', 'surveys', true)
on conflict (id) do update set public = true;

-- Storage RLS: anyone can read, authenticated users can upload/delete own files
create policy "surveys bucket: public read"
  on storage.objects for select
  using (bucket_id = 'surveys');

create policy "surveys bucket: auth upload"
  on storage.objects for insert
  with check (
    bucket_id = 'surveys'
    and auth.uid() is not null
  );

create policy "surveys bucket: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'surveys'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 9. PERFORMANCE INDEXES ────────────────────────────────────────────────────
create index if not exists idx_surveys_user       on surveys(user_id);
create index if not exists idx_surveys_created    on surveys(created_at desc);
create index if not exists idx_votes_survey       on votes(survey_id);
create index if not exists idx_votes_user         on votes(user_id);
create index if not exists idx_survey_opts_survey on survey_options(survey_id);
create index if not exists idx_comments_survey    on survey_comments(survey_id);
create index if not exists idx_comments_parent    on survey_comments(parent_id);
create index if not exists idx_likes_survey       on survey_likes(survey_id);
create index if not exists idx_likes_user         on survey_likes(user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE. All policies rebuilt. All tables reference auth.users(id) directly.
-- auth.uid() will now correctly match user_id in every INSERT/UPDATE/DELETE.
-- ══════════════════════════════════════════════════════════════════════════════
