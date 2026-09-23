-- ── Flicks Studio & Verified Creator System ─────────────────────────────────
-- Run this once in your Supabase SQL editor.

-- 1. Add creator fields to profiles
alter table public.profiles
  add column if not exists is_official_creator  boolean   not null default false,
  add column if not exists creator_id           text      unique,
  add column if not exists total_posts_count     bigint    not null default 0,
  add column if not exists total_likes_received  bigint    not null default 0,
  add column if not exists followers_count       bigint    not null default 0;

-- Unique index on creator_id for fast lookup and enforcement
create unique index if not exists idx_profiles_creator_id
  on public.profiles (creator_id)
  where creator_id is not null;

-- 2. Index for fast feed filtering of official creators
create index if not exists idx_profiles_official_creator
  on public.profiles (is_official_creator)
  where is_official_creator = true;

-- 3. Trigger: auto-increment total_posts_count when a new post is inserted
create or replace function public.increment_creator_posts_count()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles
    set total_posts_count = total_posts_count + 1
  where id = NEW.author_id
    and is_official_creator = true;
  return NEW;
end;
$$;

drop trigger if exists trg_creator_posts_count on public.posts;
create trigger trg_creator_posts_count
  after insert on public.posts
  for each row execute function public.increment_creator_posts_count();

-- 4. Trigger: auto-increment total_likes_received when a like is added
--    (assumes a `likes` table with post_id and a join to posts.author_id)
create or replace function public.increment_creator_likes_received()
returns trigger language plpgsql security definer as $$
declare
  v_author uuid;
begin
  select author_id into v_author from public.posts where id = NEW.post_id;
  if v_author is not null then
    update public.profiles
      set total_likes_received = total_likes_received + 1
    where id = v_author
      and is_official_creator = true;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_creator_likes_received on public.likes;
create trigger trg_creator_likes_received
  after insert on public.likes
  for each row execute function public.increment_creator_likes_received();

-- 5. Trigger: sync followers_count from the follows table
create or replace function public.sync_creator_followers_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles
      set followers_count = followers_count + 1
    where id = NEW.following_id;
  elsif TG_OP = 'DELETE' then
    update public.profiles
      set followers_count = greatest(followers_count - 1, 0)
    where id = OLD.following_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_followers_count on public.follows;
create trigger trg_sync_followers_count
  after insert or delete on public.follows
  for each row execute function public.sync_creator_followers_count();

-- 6. RLS: allow users to update only their own creator-related fields
--    (the existing "users can update own profile" policy covers this if already set)
--    No new policy needed if profiles already has: using (auth.uid() = id).

-- 7. Optional: backfill followers_count for existing profiles
--    Uncomment and run once if you have existing follow data:
-- update public.profiles p
--   set followers_count = (select count(*) from public.follows f where f.following_id = p.id);

-- 8. Optional: backfill total_posts_count for existing creators
-- update public.profiles p
--   set total_posts_count = (select count(*) from public.posts where author_id = p.id)
--   where is_official_creator = true;
