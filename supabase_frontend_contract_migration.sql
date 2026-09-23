-- FlicksIndia frontend contract migration
--
-- This migration matches the current React/Supabase calls in:
--   src/components/SurveyFeed.tsx
--   src/pages/SurveyDetail.tsx
--   src/components/FameFeed.tsx
--   src/components/Header.tsx
--   src/components/CirclePage.tsx
--   src/pages/Index.tsx
--
-- Important naming notes:
--   * "pages" in the UI is public.hook_pages.
--   * "circle" in the UI is public.circles.
--   * FameFeed writes public.likes; Header reads/writes public.post_likes.
--     The sync triggers below keep both paths consistent.
--   * Reels are not a separate table in this frontend. They are rows in
--     public.posts with type = 'video' (and legacy type = 'reel' supported).
--   * The frontend currently has no post-save query. post_saves is included
--     as an additive table for the requested contract and future UI support.
--
-- Run this in Supabase SQL Editor after the auth.users and public.profiles
-- tables exist. It does not drop application data.

begin;

create extension if not exists pgcrypto;

-- ============================================================================
-- SURVEYS
-- ============================================================================

create table if not exists public.surveys (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  image_url  text,
  media_url  text,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.surveys add column if not exists question text;
alter table public.surveys add column if not exists image_url text;
alter table public.surveys add column if not exists media_url text;
alter table public.surveys add column if not exists user_id uuid;
alter table public.surveys add column if not exists created_at timestamptz default now();

create table if not exists public.survey_options (
  id         uuid primary key default gen_random_uuid(),
  survey_id  uuid not null references public.surveys(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id         uuid primary key default gen_random_uuid(),
  survey_id  uuid not null references public.surveys(id) on delete cascade,
  option_id  uuid not null references public.survey_options(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (survey_id, user_id)
);

create table if not exists public.survey_likes (
  id         uuid primary key default gen_random_uuid(),
  survey_id  uuid not null references public.surveys(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (survey_id, user_id)
);

create table if not exists public.survey_comments (
  id         uuid primary key default gen_random_uuid(),
  survey_id  uuid not null references public.surveys(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.survey_comments(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists surveys_created_at_idx
  on public.surveys (created_at desc);
create index if not exists survey_options_survey_id_idx
  on public.survey_options (survey_id);
create index if not exists votes_survey_id_idx
  on public.votes (survey_id);
create index if not exists survey_likes_survey_id_idx
  on public.survey_likes (survey_id);
create index if not exists survey_comments_survey_id_idx
  on public.survey_comments (survey_id, created_at desc);

alter table public.surveys enable row level security;
alter table public.survey_options enable row level security;
alter table public.votes enable row level security;
alter table public.survey_likes enable row level security;
alter table public.survey_comments enable row level security;

drop policy if exists surveys_select on public.surveys;
drop policy if exists surveys_insert on public.surveys;
drop policy if exists surveys_update on public.surveys;
drop policy if exists surveys_delete on public.surveys;
create policy surveys_select on public.surveys
  for select using (true);
create policy surveys_insert on public.surveys
  for insert with check (auth.uid() = user_id);
create policy surveys_update on public.surveys
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy surveys_delete on public.surveys
  for delete using (auth.uid() = user_id);

drop policy if exists survey_options_select on public.survey_options;
drop policy if exists survey_options_insert on public.survey_options;
drop policy if exists survey_options_update on public.survey_options;
drop policy if exists survey_options_delete on public.survey_options;
create policy survey_options_select on public.survey_options
  for select using (true);
create policy survey_options_insert on public.survey_options
  for insert with check (
    exists (
      select 1
      from public.surveys s
      where s.id = survey_options.survey_id
        and s.user_id = auth.uid()
    )
  );
create policy survey_options_update on public.survey_options
  for update using (
    exists (
      select 1
      from public.surveys s
      where s.id = survey_options.survey_id
        and s.user_id = auth.uid()
    )
  );
create policy survey_options_delete on public.survey_options
  for delete using (
    exists (
      select 1
      from public.surveys s
      where s.id = survey_options.survey_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists votes_select on public.votes;
drop policy if exists votes_insert on public.votes;
drop policy if exists votes_delete on public.votes;
create policy votes_select on public.votes
  for select using (true);
create policy votes_insert on public.votes
  for insert with check (auth.uid() = user_id);
create policy votes_delete on public.votes
  for delete using (auth.uid() = user_id);

drop policy if exists survey_likes_select on public.survey_likes;
drop policy if exists survey_likes_insert on public.survey_likes;
drop policy if exists survey_likes_delete on public.survey_likes;
create policy survey_likes_select on public.survey_likes
  for select using (true);
create policy survey_likes_insert on public.survey_likes
  for insert with check (auth.uid() = user_id);
create policy survey_likes_delete on public.survey_likes
  for delete using (auth.uid() = user_id);

drop policy if exists survey_comments_select on public.survey_comments;
drop policy if exists survey_comments_insert on public.survey_comments;
drop policy if exists survey_comments_update on public.survey_comments;
drop policy if exists survey_comments_delete on public.survey_comments;
create policy survey_comments_select on public.survey_comments
  for select using (true);
create policy survey_comments_insert on public.survey_comments
  for insert with check (auth.uid() = user_id);
create policy survey_comments_update on public.survey_comments
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy survey_comments_delete on public.survey_comments
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- HOOK PAGES + PAGE FOLLOWERS
-- ============================================================================

create table if not exists public.hook_pages (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references public.profiles(id) on delete cascade,
  name            text not null,
  description     text,
  category        text default 'General',
  cover_url       text,
  avatar_url      text,
  follower_count  integer not null default 0,
  followers_count integer not null default 0,
  hook_count      integer not null default 0,
  post_count      integer not null default 0,
  like_count      integer not null default 0,
  is_monetized    boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.hook_pages add column if not exists owner_id uuid;
alter table public.hook_pages add column if not exists name text;
alter table public.hook_pages add column if not exists description text;
alter table public.hook_pages add column if not exists category text default 'General';
alter table public.hook_pages add column if not exists cover_url text;
alter table public.hook_pages add column if not exists avatar_url text;
alter table public.hook_pages add column if not exists follower_count integer default 0;
alter table public.hook_pages add column if not exists followers_count integer default 0;
alter table public.hook_pages add column if not exists hook_count integer default 0;
alter table public.hook_pages add column if not exists post_count integer default 0;
alter table public.hook_pages add column if not exists like_count integer default 0;
alter table public.hook_pages add column if not exists is_monetized boolean default false;
alter table public.hook_pages add column if not exists created_at timestamptz default now();

create table if not exists public.page_followers (
  page_id    uuid not null references public.hook_pages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);

create index if not exists page_followers_user_id_idx
  on public.page_followers (user_id);
create index if not exists page_followers_page_id_idx
  on public.page_followers (page_id);

alter table public.hook_pages enable row level security;
alter table public.page_followers enable row level security;

drop policy if exists "Public read hook_pages" on public.hook_pages;
drop policy if exists "Owner insert hook_pages" on public.hook_pages;
drop policy if exists "Owner update hook_pages" on public.hook_pages;
drop policy if exists "Owner delete hook_pages" on public.hook_pages;
drop policy if exists "Anyone update_page followers_count" on public.hook_pages;
create policy "Public read hook_pages" on public.hook_pages
  for select using (true);
create policy "Owner insert hook_pages" on public.hook_pages
  for insert with check (auth.uid() = owner_id);
create policy "Owner update hook_pages" on public.hook_pages
  for update using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create policy "Owner delete hook_pages" on public.hook_pages
  for delete using (auth.uid() = owner_id);

drop policy if exists "Public read page_followers" on public.page_followers;
drop policy if exists "Self insert page_followers" on public.page_followers;
drop policy if exists "Self delete page_followers" on public.page_followers;
create policy "Public read page_followers" on public.page_followers
  for select using (true);
create policy "Self insert page_followers" on public.page_followers
  for insert with check (auth.uid() = user_id);
create policy "Self delete page_followers" on public.page_followers
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- CIRCLES + CIRCLE MEMBERS
-- ============================================================================

create table if not exists public.circles (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  description          text,
  cover_url            text,
  privacy              text not null default 'public',
  category             text,
  owner_id             uuid references public.profiles(id) on delete set null,
  created_by           uuid references public.profiles(id) on delete set null,
  admin_id             uuid references public.profiles(id) on delete set null,
  member_count         integer not null default 0,
  post_approval        boolean not null default true,
  rules                text,
  pinned_announcement  text,
  pinned_at            timestamptz,
  created_at           timestamptz not null default now()
);

alter table public.circles add column if not exists description text;
alter table public.circles add column if not exists cover_url text;
alter table public.circles add column if not exists privacy text default 'public';
alter table public.circles add column if not exists category text;
alter table public.circles add column if not exists owner_id uuid;
alter table public.circles add column if not exists created_by uuid;
alter table public.circles add column if not exists admin_id uuid;
alter table public.circles add column if not exists member_count integer default 0;
alter table public.circles add column if not exists post_approval boolean default true;
alter table public.circles add column if not exists rules text;
alter table public.circles add column if not exists pinned_announcement text;
alter table public.circles add column if not exists pinned_at timestamptz;
alter table public.circles add column if not exists created_at timestamptz default now();

create table if not exists public.circle_members (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member'
    check (role in ('admin', 'moderator', 'member')),
  joined_at  timestamptz not null default now(),
  unique (circle_id, user_id)
);

alter table public.circle_members add column if not exists role text default 'member';
alter table public.circle_members add column if not exists joined_at timestamptz default now();
create unique index if not exists circle_members_circle_user_idx
  on public.circle_members (circle_id, user_id);
create index if not exists circle_members_user_id_idx
  on public.circle_members (user_id);

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;

drop policy if exists "Public read circles" on public.circles;
drop policy if exists "Auth create circle" on public.circles;
create policy "Public read circles" on public.circles
  for select using (true);
create policy "Auth create circle" on public.circles
  for insert with check (
    auth.uid() is not null
    and (auth.uid() = created_by or auth.uid() = admin_id or auth.uid() = owner_id)
  );

drop policy if exists "Public read circle members" on public.circle_members;
drop policy if exists "Auth join circle" on public.circle_members;
drop policy if exists "Self delete circle membership" on public.circle_members;
drop policy if exists "Circle admin update members" on public.circle_members;
create policy "Public read circle members" on public.circle_members
  for select using (true);
create policy "Auth join circle" on public.circle_members
  for insert with check (auth.uid() = user_id);
create policy "Self delete circle membership" on public.circle_members
  for delete using (auth.uid() = user_id);
create policy "Circle admin update members" on public.circle_members
  for update using (
    exists (
      select 1
      from public.circle_members manager
      where manager.circle_id = circle_members.circle_id
        and manager.user_id = auth.uid()
        and manager.role in ('admin', 'moderator')
    )
  )
  with check (
    exists (
      select 1
      from public.circle_members manager
      where manager.circle_id = circle_members.circle_id
        and manager.user_id = auth.uid()
        and manager.role in ('admin', 'moderator')
    )
  );

-- ============================================================================
-- POSTS, COMMENTS, SHARES, VIEWS, LIKES, SAVES
-- ============================================================================

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references public.profiles(id) on delete cascade,
  author          text,
  content         text,
  media_url       text,
  image_url       text,
  cover_url       text,
  media_type      text,
  type            text not null default 'text',
  post_type       text default 'fame',
  likes_count     integer not null default 0,
  comments_count  integer not null default 0,
  views_count     integer not null default 0,
  shares_count    integer not null default 0,
  visibility      text not null default 'public',
  is_admin_post   boolean not null default false,
  metadata        jsonb not null default '{}'::jsonb,
  meta_title      text,
  meta_description text,
  seo_keywords    text[],
  created_at      timestamptz not null default now()
);

alter table public.posts add column if not exists author_id uuid;
alter table public.posts add column if not exists author text;
alter table public.posts add column if not exists content text;
alter table public.posts add column if not exists media_url text;
alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists cover_url text;
alter table public.posts add column if not exists media_type text;
alter table public.posts add column if not exists type text default 'text';
alter table public.posts add column if not exists post_type text default 'fame';
alter table public.posts add column if not exists likes_count integer default 0;
alter table public.posts add column if not exists comments_count integer default 0;
alter table public.posts add column if not exists views_count integer default 0;
alter table public.posts add column if not exists shares_count integer default 0;
alter table public.posts add column if not exists visibility text default 'public';
alter table public.posts add column if not exists is_admin_post boolean default false;
alter table public.posts add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.posts add column if not exists meta_title text;
alter table public.posts add column if not exists meta_description text;
alter table public.posts add column if not exists seo_keywords text[];
alter table public.posts add column if not exists created_at timestamptz default now();

create table if not exists public.comments (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid references public.posts(id) on delete cascade,
  user_id        uuid references public.profiles(id) on delete cascade,
  author         text,
  content        text not null,
  parent_id      uuid references public.comments(id) on delete cascade,
  is_hidden      boolean not null default false,
  hidden_by_id   uuid references public.profiles(id) on delete set null,
  hidden_by_name text,
  created_at     timestamptz not null default now()
);

alter table public.comments add column if not exists post_id uuid;
alter table public.comments add column if not exists user_id uuid;
alter table public.comments add column if not exists author text;
alter table public.comments add column if not exists parent_id uuid;
alter table public.comments add column if not exists is_hidden boolean default false;
alter table public.comments add column if not exists hidden_by_id uuid;
alter table public.comments add column if not exists hidden_by_name text;
alter table public.comments add column if not exists created_at timestamptz default now();

create table if not exists public.shares (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.likes (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  reaction_type text,
  created_at    timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.likes add column if not exists reaction_type text;
create unique index if not exists likes_post_id_user_id_key
  on public.likes (post_id, user_id);

-- Header.tsx uses this name while FameFeed.tsx uses public.likes.
create table if not exists public.post_likes (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  reaction_type text,
  created_at    timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.post_likes add column if not exists reaction_type text;
create unique index if not exists post_likes_post_id_user_id_key
  on public.post_likes (post_id, user_id);

create table if not exists public.post_saves (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.post_views (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid not null references public.posts(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete set null,
  viewed_at timestamptz not null default now()
);

create unique index if not exists post_views_post_user_idx
  on public.post_views (post_id, user_id)
  where user_id is not null;
create index if not exists comments_post_id_idx
  on public.comments (post_id, created_at desc);
create index if not exists likes_post_id_idx
  on public.likes (post_id);
create index if not exists shares_post_id_idx
  on public.shares (post_id);
create index if not exists post_saves_user_id_idx
  on public.post_saves (user_id, created_at desc);
create index if not exists posts_created_at_idx
  on public.posts (created_at desc);
create index if not exists posts_type_created_at_idx
  on public.posts (type, created_at desc);
create index if not exists posts_visibility_created_at_idx
  on public.posts (visibility, created_at desc);

alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.shares enable row level security;
alter table public.likes enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.post_views enable row level security;

drop policy if exists "Public read posts" on public.posts;
drop policy if exists "Owner insert post" on public.posts;
drop policy if exists "Owner update post" on public.posts;
drop policy if exists "Owner delete post" on public.posts;
create policy "Public read posts" on public.posts
  for select using (visibility = 'public' or auth.uid() = author_id);
create policy "Owner insert post" on public.posts
  for insert with check (auth.uid() = author_id);
create policy "Owner update post" on public.posts
  for update using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
create policy "Owner delete post" on public.posts
  for delete using (auth.uid() = author_id);

drop policy if exists comments_select_all on public.comments;
drop policy if exists comments_insert_own on public.comments;
drop policy if exists comments_update_own on public.comments;
drop policy if exists comments_delete_own on public.comments;
create policy comments_select_all on public.comments
  for select using (true);
create policy comments_insert_own on public.comments
  for insert with check (auth.uid() = user_id);
create policy comments_update_own on public.comments
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy comments_delete_own on public.comments
  for delete using (auth.uid() = user_id);

drop policy if exists "Public read shares" on public.shares;
drop policy if exists "Auth insert share" on public.shares;
create policy "Public read shares" on public.shares
  for select using (true);
create policy "Auth insert share" on public.shares
  for insert with check (auth.uid() = user_id);

drop policy if exists "Public read likes" on public.likes;
drop policy if exists "Auth insert like" on public.likes;
drop policy if exists "Auth update like" on public.likes;
drop policy if exists "Auth delete like" on public.likes;
create policy "Public read likes" on public.likes
  for select using (true);
create policy "Auth insert like" on public.likes
  for insert with check (auth.uid() = user_id);
create policy "Auth update like" on public.likes
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Auth delete like" on public.likes
  for delete using (auth.uid() = user_id);

drop policy if exists "Public read post_likes" on public.post_likes;
drop policy if exists "Auth insert post_likes" on public.post_likes;
drop policy if exists "Auth update post_likes" on public.post_likes;
drop policy if exists "Auth delete post_likes" on public.post_likes;
create policy "Public read post_likes" on public.post_likes
  for select using (true);
create policy "Auth insert post_likes" on public.post_likes
  for insert with check (auth.uid() = user_id);
create policy "Auth update post_likes" on public.post_likes
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Auth delete post_likes" on public.post_likes
  for delete using (auth.uid() = user_id);

drop policy if exists "Public read post_saves" on public.post_saves;
drop policy if exists "Auth insert post_saves" on public.post_saves;
drop policy if exists "Auth delete post_saves" on public.post_saves;
create policy "Public read post_saves" on public.post_saves
  for select using (auth.uid() = user_id);
create policy "Auth insert post_saves" on public.post_saves
  for insert with check (auth.uid() = user_id);
create policy "Auth delete post_saves" on public.post_saves
  for delete using (auth.uid() = user_id);

drop policy if exists "Auth insert post views" on public.post_views;
drop policy if exists "Auth read post views" on public.post_views;
create policy "Auth insert post views" on public.post_views
  for insert with check (auth.uid() = user_id or user_id is null);
create policy "Auth read post views" on public.post_views
  for select using (auth.uid() is not null);

-- Keep Header.tsx and FameFeed.tsx on one logical like set.
create or replace function public.sync_likes_to_post_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.post_likes (post_id, user_id, reaction_type, created_at)
    values (new.post_id, new.user_id, new.reaction_type, new.created_at)
    on conflict (post_id, user_id) do update
      set reaction_type = excluded.reaction_type;
    return new;
  elsif tg_op = 'UPDATE'
    and new.reaction_type is distinct from old.reaction_type then
    update public.post_likes
       set reaction_type = new.reaction_type
     where post_id = new.post_id and user_id = new.user_id;
    return new;
  elsif tg_op = 'DELETE' then
    delete from public.post_likes
     where post_id = old.post_id and user_id = old.user_id;
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.sync_post_likes_to_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.likes (post_id, user_id, reaction_type, created_at)
    values (new.post_id, new.user_id, new.reaction_type, new.created_at)
    on conflict (post_id, user_id) do update
      set reaction_type = excluded.reaction_type;
    return new;
  elsif tg_op = 'UPDATE'
    and new.reaction_type is distinct from old.reaction_type then
    update public.likes
       set reaction_type = new.reaction_type
     where post_id = new.post_id and user_id = new.user_id;
    return new;
  elsif tg_op = 'DELETE' then
    delete from public.likes
     where post_id = old.post_id and user_id = old.user_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_likes_to_post_likes on public.likes;
create trigger trg_sync_likes_to_post_likes
after insert or update of reaction_type or delete on public.likes
for each row execute function public.sync_likes_to_post_likes();

drop trigger if exists trg_sync_post_likes_to_likes on public.post_likes;
create trigger trg_sync_post_likes_to_likes
after insert or update of reaction_type or delete on public.post_likes
for each row execute function public.sync_post_likes_to_likes();

-- Keep the denormalized comments_count field usable by the existing UI.
create or replace function public.update_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
       set comments_count = coalesce(comments_count, 0) + 1
     where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
       set comments_count = greatest(coalesce(comments_count, 0) - 1, 0)
     where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_post_comments_count on public.comments;
create trigger trg_post_comments_count
after insert or delete on public.comments
for each row execute function public.update_post_comments_count();

-- ============================================================================
-- REQUIRED RPC FUNCTIONS
-- ============================================================================

create or replace function public.get_survey_vote_counts(p_survey_ids uuid[])
returns table (
  survey_id   uuid,
  option_id   uuid,
  vote_count  bigint,
  total_votes bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_survey_ids, '{}'::uuid[])) as survey_id
  ),
  option_counts as (
    select v.survey_id, v.option_id, count(*)::bigint as vote_count
    from public.votes v
    join requested r on r.survey_id = v.survey_id
    group by v.survey_id, v.option_id
  ),
  survey_totals as (
    select v.survey_id, count(*)::bigint as total_votes
    from public.votes v
    join requested r on r.survey_id = v.survey_id
    group by v.survey_id
  )
  select so.survey_id,
         so.id,
         coalesce(oc.vote_count, 0)::bigint,
         coalesce(st.total_votes, 0)::bigint
    from public.survey_options so
    join requested r on r.survey_id = so.survey_id
    left join option_counts oc
      on oc.survey_id = so.survey_id
     and oc.option_id = so.id
    left join survey_totals st on st.survey_id = so.survey_id;
$$;

create or replace function public.get_trending_surveys(p_limit integer default 3)
returns table (survey_id uuid, total_votes bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select v.survey_id, count(*)::bigint
    from public.votes v
    join public.surveys s on s.id = v.survey_id
   group by v.survey_id
   order by count(*) desc, v.survey_id
   limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

create or replace function public.get_survey_engagement_counts(p_survey_ids uuid[])
returns table (
  survey_id     uuid,
  likes_count   bigint,
  comments_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_survey_ids, '{}'::uuid[])) as survey_id
  ),
  likes as (
    select survey_id, count(*)::bigint as likes_count
      from public.survey_likes
     group by survey_id
  ),
  comments as (
    select survey_id, count(*)::bigint as comments_count
      from public.survey_comments
     group by survey_id
  )
  select r.survey_id,
         coalesce(l.likes_count, 0)::bigint,
         coalesce(c.comments_count, 0)::bigint
    from requested r
    left join likes l using (survey_id)
    left join comments c using (survey_id);
$$;

create or replace function public.get_post_engagement_counts(
  p_post_ids uuid[],
  p_viewer_id uuid default null
)
returns table (
  post_id       uuid,
  likes_count   bigint,
  comments_count bigint,
  shares_count  bigint,
  liked_by_me   boolean,
  reaction_type text
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_post_ids, '{}'::uuid[])) as post_id
  )
  select r.post_id,
         (
           select count(*)::bigint
             from public.likes l
            where l.post_id = r.post_id
         ),
         (
           select count(*)::bigint
             from public.comments c
            where c.post_id = r.post_id
         ),
         (
           select count(*)::bigint
             from public.shares s
            where s.post_id = r.post_id
         ),
         exists (
           select 1
             from public.likes l
            where l.post_id = r.post_id
              and p_viewer_id is not null
              and l.user_id = p_viewer_id
         ),
         (
           select l.reaction_type::text
             from public.likes l
            where l.post_id = r.post_id
              and p_viewer_id is not null
              and l.user_id = p_viewer_id
            limit 1
         )
    from requested r;
$$;

create or replace function public.get_page_follower_counts(p_page_ids uuid[])
returns table (page_id uuid, follower_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_page_ids, '{}'::uuid[])) as page_id
  )
  select r.page_id, count(pf.user_id)::bigint
    from requested r
    left join public.page_followers pf on pf.page_id = r.page_id
   group by r.page_id;
$$;

create or replace function public.get_circle_member_counts(p_circle_ids uuid[])
returns table (circle_id uuid, member_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_circle_ids, '{}'::uuid[])) as circle_id
  )
  select r.circle_id, count(cm.user_id)::bigint
    from requested r
    left join public.circle_members cm on cm.circle_id = r.circle_id
   group by r.circle_id;
$$;

-- Reels use public.posts in the current frontend. This helper accepts only
-- posts that are actually video/reel rows and returns the same engagement
-- fields plus the denormalized view count used by Index.tsx.
create or replace function public.get_reel_engagement_counts(
  p_reel_ids uuid[],
  p_viewer_id uuid default null
)
returns table (
  reel_id        uuid,
  likes_count    bigint,
  comments_count bigint,
  shares_count   bigint,
  views_count    bigint,
  liked_by_me    boolean,
  reaction_type  text
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_reel_ids, '{}'::uuid[])) as reel_id
  )
  select p.id,
         (
           select count(*)::bigint
             from public.likes l
            where l.post_id = p.id
         ),
         (
           select count(*)::bigint
             from public.comments c
            where c.post_id = p.id
         ),
         (
           select count(*)::bigint
             from public.shares s
            where s.post_id = p.id
         ),
         coalesce(p.views_count, 0)::bigint,
         exists (
           select 1
             from public.likes l
            where l.post_id = p.id
              and p_viewer_id is not null
              and l.user_id = p_viewer_id
         ),
         (
           select l.reaction_type::text
             from public.likes l
            where l.post_id = p.id
              and p_viewer_id is not null
              and l.user_id = p_viewer_id
            limit 1
         )
    from requested r
    join public.posts p on p.id = r.reel_id
   where p.type in ('video', 'reel')
      or p.media_type = 'video';
$$;

create or replace function public.increment_post_views(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
     set views_count = coalesce(views_count, 0) + 1
   where id = p_post_id;
end;
$$;

grant execute on function public.get_survey_vote_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_trending_surveys(integer) to anon, authenticated;
grant execute on function public.get_survey_engagement_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_post_engagement_counts(uuid[], uuid) to anon, authenticated;
grant execute on function public.get_page_follower_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_circle_member_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_reel_engagement_counts(uuid[], uuid) to anon, authenticated;
grant execute on function public.increment_post_views(uuid) to anon, authenticated;

-- Backfill the denormalized counts that are displayed directly by the UI.
update public.posts p
   set comments_count = (
     select count(*)::integer
       from public.comments c
      where c.post_id = p.id
   );

commit;