-- ═══════════════════════════════════════════════════════════════════════════
--  STEP 2 — ADMIN RLS + MODERATION + CIRCLES + COMMENTS (Run AFTER Step 1)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ADMIN RLS POLICIES ─────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'likes_post_id_user_id_key' AND conrelid = 'likes'::regclass
  ) THEN ALTER TABLE likes ADD CONSTRAINT likes_post_id_user_id_key UNIQUE (post_id, user_id); END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'admin_delete_posts'
  ) THEN EXECUTE $policy$
    CREATE POLICY "admin_delete_posts" ON posts FOR DELETE USING (
      auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com') OR auth.uid() = author_id
    );
  $policy$; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'admin_update_posts'
  ) THEN EXECUTE $policy$
    CREATE POLICY "admin_update_posts" ON posts FOR UPDATE USING (
      auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com') OR auth.uid() = author_id
    );
  $policy$; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'owner_delete_posts'
  ) THEN EXECUTE $policy$
    CREATE POLICY "owner_delete_posts" ON posts FOR DELETE USING (auth.uid() = author_id);
  $policy$; END IF;
END $$;

-- ── 2. MODERATION TABLES ─────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists account_status text not null default 'active',
  add column if not exists suspension_reason text;

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.posts(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy if not exists "Anyone can insert a report" on public.reports for insert with check (auth.uid() = reporter_id);
create policy if not exists "Admins can read all reports" on public.reports for select using (true);
create policy if not exists "Admins can delete reports" on public.reports for delete using (true);
create policy if not exists "Admins can update any profile" on public.profiles for update using (true);
create index if not exists idx_profiles_account_status on public.profiles(account_status);
create index if not exists idx_reports_post_id on public.reports(post_id);

-- ── 3. CIRCLES (social groups) ──────────────────────────────────────────────────────────
alter table if exists circles add column if not exists admin_id uuid;
alter table if exists circles add column if not exists rules text;
alter table if exists circles add column if not exists post_approval boolean default true;
alter table if exists circles add column if not exists member_count integer default 0;

alter table if exists circle_members add column if not exists role text default 'member';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'circle_members_role_check')
    THEN ALTER TABLE circle_members ADD CONSTRAINT circle_members_role_check
    CHECK (role IN ('admin', 'moderator', 'member')); END IF;
END $$;
create unique index if not exists circle_members_circle_user_idx on circle_members(circle_id, user_id);

create table if not exists circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text not null default 'Member', author_avatar text,
  content text not null default '', media_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  likes_count integer not null default 0, comments_count integer not null default 0,
  shares_count integer not null default 0, comments_muted boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists circle_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references circle_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(), unique(post_id, user_id)
);
create table if not exists circle_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references circle_posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text not null default 'Member', author_avatar text,
  content text not null, created_at timestamptz not null default now()
);
create table if not exists circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  inviter_id uuid not null references profiles(id) on delete cascade,
  invitee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(), unique(circle_id, invitee_id)
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
drop policy if exists "circle_invites_select" on circle_invites;
drop policy if exists "circle_invites_insert" on circle_invites;
drop policy if exists "circle_invites_update" on circle_invites;
drop policy if exists "circle_invites_delete" on circle_invites;

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
create policy "circle_invites_select" on circle_invites for select using (auth.uid() is not null);
create policy "circle_invites_insert" on circle_invites for insert with check (auth.uid() is not null);
create policy "circle_invites_update" on circle_invites for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "circle_invites_delete" on circle_invites for delete using (auth.uid() is not null);

do $$ begin
  begin alter publication supabase_realtime add table circle_posts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_post_likes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_post_comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_invites; exception when duplicate_object then null; end;
end $$;

-- ── 4. CIRCLE EVENTS & RSVPs ──────────────────────────────────────────────────────────
alter table circles add column if not exists pinned_announcement text;

create table if not exists circle_events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  title text not null, description text, event_date date not null,
  event_time time, location text, created_at timestamptz not null default now()
);
create table if not exists circle_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references circle_events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'not_going')),
  created_at timestamptz not null default now(), unique(event_id, user_id)
);
create index if not exists circle_events_circle_idx on circle_events(circle_id, event_date asc);
create index if not exists circle_event_rsvps_event_idx on circle_event_rsvps(event_id);
create index if not exists circle_event_rsvps_user_idx on circle_event_rsvps(user_id);

alter table circle_events enable row level security;
alter table circle_event_rsvps enable row level security;
drop policy if exists "circle_events_read" on circle_events;
drop policy if exists "circle_events_insert_admin" on circle_events;
drop policy if exists "circle_events_delete_admin" on circle_events;
drop policy if exists "circle_rsvps_read" on circle_event_rsvps;
drop policy if exists "circle_rsvps_insert_own" on circle_event_rsvps;
drop policy if exists "circle_rsvps_update_own" on circle_event_rsvps;
drop policy if exists "circle_rsvps_delete_own" on circle_event_rsvps;

create policy "circle_events_read" on circle_events for select using (true);
create policy "circle_events_insert_admin" on circle_events for insert with check (auth.uid() = created_by);
create policy "circle_events_delete_admin" on circle_events for delete using (auth.uid() = created_by);
create policy "circle_rsvps_read" on circle_event_rsvps for select using (true);
create policy "circle_rsvps_insert_own" on circle_event_rsvps for insert with check (auth.uid() = user_id);
create policy "circle_rsvps_update_own" on circle_event_rsvps for update using (auth.uid() = user_id);
create policy "circle_rsvps_delete_own" on circle_event_rsvps for delete using (auth.uid() = user_id);

do $$ begin
  begin alter publication supabase_realtime add table circle_events; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_event_rsvps; exception when duplicate_object then null; end;
end $$;

-- ── 5. CIRCLE POST VIEWS ──────────────────────────────────────────────────────────────────

create table if not exists circle_post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references circle_posts(id) on delete cascade not null,
  viewer_id uuid references auth.users(id) on delete cascade not null,
  viewed_at timestamptz default now() not null,
  unique(post_id, viewer_id)
);
alter table circle_post_views enable row level security;
create policy "allow all for authenticated" on circle_post_views for all using (true) with check (true);
create index if not exists idx_circle_post_views_post_id on circle_post_views(post_id);
create index if not exists idx_circle_post_views_viewer_id on circle_post_views(viewer_id);

-- ── 6. COMMENTS TRIGGERS + RLS FIXES ───────────────────────────────────────────────────
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS hidden_by_id uuid;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS hidden_by_name text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.posts SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.posts SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0) WHERE id = OLD.post_id; END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_post_comments_count ON public.comments;
CREATE TRIGGER trg_post_comments_count AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();
UPDATE public.posts p SET comments_count = (SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select_all" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
DROP POLICY IF EXISTS "comments_update_own" ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
CREATE POLICY "comments_select_all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY "comments_update_own" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE USING (
  auth.uid() = user_id OR auth.uid() IN (SELECT author_id FROM public.posts WHERE id = comments.post_id)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
);

-- Comment moderation columns for Circle posts too
ALTER TABLE circle_post_comments ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
ALTER TABLE circle_post_comments ADD COLUMN IF NOT EXISTS hidden_by_id uuid REFERENCES auth.users(id);
ALTER TABLE circle_post_comments ADD COLUMN IF NOT EXISTS hidden_by_name text;

-- ── 7. RLS FIXES (posts, likes, profiles) ─────────────────────────────────────────────────────
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE USING (
  auth.uid() = author_id OR (SELECT email FROM auth.users WHERE id = auth.uid())
    IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE USING (
  auth.uid() = author_id OR (SELECT email FROM auth.users WHERE id = auth.uid())
    IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com')
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes_select_all" ON public.likes;
DROP POLICY IF EXISTS "likes_insert_own" ON public.likes;
DROP POLICY IF EXISTS "likes_delete_own" ON public.likes;
CREATE POLICY "likes_select_all" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_own" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON public.likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "likes_update_own" ON public.likes FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
