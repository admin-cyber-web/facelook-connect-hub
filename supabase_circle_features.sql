alter table if exists circles add column if not exists admin_id uuid;
alter table if exists circles add column if not exists rules text;
alter table if exists circles add column if not exists post_approval boolean default true;
alter table if exists circles add column if not exists member_count integer default 0;

alter table if exists circle_members add column if not exists role text default 'member';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'circle_members_role_check'
  ) then
    alter table circle_members add constraint circle_members_role_check check (role in ('admin', 'moderator', 'member'));
  end if;
end $$;
create unique index if not exists circle_members_circle_user_idx on circle_members(circle_id, user_id);

create table if not exists circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text not null default 'Member',
  author_avatar text,
  content text not null default '',
  media_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  shares_count integer not null default 0,
  comments_muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists circle_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references circle_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists circle_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references circle_posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text not null default 'Member',
  author_avatar text,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  inviter_id uuid not null references profiles(id) on delete cascade,
  invitee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique(circle_id, invitee_id)
);

create index if not exists circle_posts_circle_status_idx on circle_posts(circle_id, status, created_at desc);
create index if not exists circle_post_comments_post_idx on circle_post_comments(post_id, created_at asc);
create index if not exists circle_invites_invitee_idx on circle_invites(invitee_id, status, created_at desc);

alter table circle_posts enable row level security;
alter table circle_post_likes enable row level security;
alter table circle_post_comments enable row level security;
alter table circle_invites enable row level security;

drop policy if exists "circle_posts_read" on circle_posts;
drop policy if exists "circle_posts_insert_auth" on circle_posts;
drop policy if exists "circle_posts_update_auth" on circle_posts;
drop policy if exists "circle_posts_delete_auth" on circle_posts;
drop policy if exists "circle_likes_read" on circle_post_likes;
drop policy if exists "circle_likes_insert_own" on circle_post_likes;
drop policy if exists "circle_likes_delete_own" on circle_post_likes;
drop policy if exists "circle_comments_read" on circle_post_comments;
drop policy if exists "circle_comments_insert_own" on circle_post_comments;
drop policy if exists "circle_comments_delete_auth" on circle_post_comments;
drop policy if exists "circle_invites_read_own" on circle_invites;
drop policy if exists "circle_invites_insert_auth" on circle_invites;
drop policy if exists "circle_invites_update_own" on circle_invites;

create policy "circle_posts_read" on circle_posts for select using (true);
create policy "circle_posts_insert_auth" on circle_posts for insert with check (auth.uid() = author_id);
create policy "circle_posts_update_auth" on circle_posts for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "circle_posts_delete_auth" on circle_posts for delete using (auth.uid() is not null);

create policy "circle_likes_read" on circle_post_likes for select using (true);
create policy "circle_likes_insert_own" on circle_post_likes for insert with check (auth.uid() = user_id);
create policy "circle_likes_delete_own" on circle_post_likes for delete using (auth.uid() = user_id);

create policy "circle_comments_read" on circle_post_comments for select using (true);
create policy "circle_comments_insert_own" on circle_post_comments for insert with check (auth.uid() = author_id);
create policy "circle_comments_delete_auth" on circle_post_comments for delete using (auth.uid() is not null);

create policy "circle_invites_read_own" on circle_invites for select using (auth.uid() = invitee_id or auth.uid() = inviter_id);
create policy "circle_invites_insert_auth" on circle_invites for insert with check (auth.uid() = inviter_id);
create policy "circle_invites_update_own" on circle_invites for update using (auth.uid() = invitee_id or auth.uid() = inviter_id) with check (auth.uid() = invitee_id or auth.uid() = inviter_id);

do $$
begin
  begin alter publication supabase_realtime add table circle_posts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_post_likes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_post_comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_invites; exception when duplicate_object then null; end;
end $$;
