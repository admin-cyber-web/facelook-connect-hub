-- ═══════════════════════════════════════════════════════════════════════════
--  STEP 3 — FEATURE TABLES: Hook Pages, Magnet, Privacy, Friends, Notifications
--  Run AFTER Step 1 + Step 2
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. HOOK PAGES ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hook_pages (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  category      text DEFAULT 'General',
  cover_url     text,
  avatar_url    text,
  follower_count int  DEFAULT 0,
  hook_count    int  DEFAULT 0,
  post_count    int  DEFAULT 0,
  like_count    int  DEFAULT 0,
  is_monetized  boolean DEFAULT false,
  followers_count int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hook_page_posts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id     uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES profiles(id),
  content     text,
  media_url   text,
  media_type  text DEFAULT '',
  likes_count int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hook_invites (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id     uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  inviter_id  uuid REFERENCES profiles(id),
  invitee_id  uuid REFERENCES profiles(id),
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(page_id, invitee_id)
);

CREATE TABLE IF NOT EXISTS hook_members (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id   uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(page_id, user_id)
);

CREATE TABLE IF NOT EXISTS page_followers (
  page_id    uuid REFERENCES hook_pages(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (page_id, user_id)
);

ALTER TABLE hook_pages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_page_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_invites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_followers  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hook_pages"      ON hook_pages      FOR SELECT USING (true);
CREATE POLICY "Owner insert hook_pages"     ON hook_pages      FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner update hook_pages"     ON hook_pages      FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner delete hook_pages"     ON hook_pages      FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Anyone update_page followers_count" ON hook_pages FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Public read hook_page_posts" ON hook_page_posts FOR SELECT USING (true);
CREATE POLICY "Author insert hook_posts"    ON hook_page_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author delete hook_posts"    ON hook_page_posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Public read hook_invites"    ON hook_invites    FOR SELECT USING (true);
CREATE POLICY "Inviter insert hook_invites" ON hook_invites    FOR INSERT WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "Update hook_invites"         ON hook_invites    FOR UPDATE USING (true);

CREATE POLICY "Public read hook_members"    ON hook_members    FOR SELECT USING (true);
CREATE POLICY "Self insert hook_members"    ON hook_members    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Self update hook_members"    ON hook_members    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Self delete hook_members"    ON hook_members    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public read page_followers"  ON page_followers FOR SELECT USING (true);
CREATE POLICY "Self insert page_followers"  ON page_followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Self delete page_followers"  ON page_followers FOR DELETE USING (auth.uid() = user_id);

-- ── 2. MAGNET SYSTEM (Viral chain) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS magnet_chains (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          TEXT NOT NULL,
  post_type        TEXT NOT NULL DEFAULT 'flick',
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  parent_magnet_id UUID REFERENCES magnet_chains(id) ON DELETE CASCADE,
  depth            INT  NOT NULL DEFAULT 0,
  is_killed        BOOL NOT NULL DEFAULT FALSE,
  is_muted         BOOL NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_magnet_voice (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      TEXT NOT NULL,
  post_type    TEXT NOT NULL DEFAULT 'flick',
  owner_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status_text  TEXT,
  is_warning   BOOL NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, post_type)
);

CREATE INDEX IF NOT EXISTS magnet_post_idx    ON magnet_chains(post_id, post_type);
CREATE INDEX IF NOT EXISTS magnet_parent_idx  ON magnet_chains(parent_magnet_id);
CREATE INDEX IF NOT EXISTS magnet_user_idx    ON magnet_chains(user_id);
CREATE INDEX IF NOT EXISTS magnet_depth_idx   ON magnet_chains(post_id, depth);

ALTER PUBLICATION supabase_realtime ADD TABLE magnet_chains;
ALTER PUBLICATION supabase_realtime ADD TABLE post_magnet_voice;

-- ── 3. PRIVACY + FRIENDSHIPS ───────────────────────────────────────────────────────────────
alter table profiles add column if not exists is_private_mode boolean default false,
  add column if not exists last_seen timestamptz default now();
alter table posts add column if not exists visibility text default 'public';

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  status text default 'pending',
  created_at timestamptz default now(),
  unique (sender_id, receiver_id)
);
alter table friendships enable row level security;
create policy "Users can view own friendships"   on friendships for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users can send friend requests"     on friendships for insert with check (auth.uid() = sender_id);
create policy "Users can update own friendships"   on friendships for update using (auth.uid() = sender_id or auth.uid() = receiver_id);

create or replace function update_last_seen(user_uuid uuid) returns void language plpgsql security definer as $$
begin update profiles set last_seen = now() where id = user_uuid; end; $$;
grant execute on function update_last_seen(uuid) to authenticated;

create index if not exists idx_posts_visibility on posts(visibility);
create index if not exists idx_posts_author_visibility on posts(author_id, visibility);

-- ── 4. MODERATION (user_blocks + expanded reports) ────────────────────────────────────────
alter table public.reports add column if not exists target_id uuid references auth.users(id) on delete cascade;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reports' and column_name = 'post_id' and is_nullable = 'NO'
  ) then execute 'alter table public.reports alter column post_id drop not null'; end if;
end $$;
create index if not exists idx_reports_target_id on public.reports(target_id);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index if not exists idx_user_blocks_blocked_id on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;
create policy "Users can read their own blocks" on public.user_blocks for select using (auth.uid() = blocker_id or auth.uid() = blocked_id);
create policy "Users can block others" on public.user_blocks for insert with check (auth.uid() = blocker_id);
create policy "Users can unblock others" on public.user_blocks for delete using (auth.uid() = blocker_id);

-- ── 5. NOTIFICATIONS ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notifier_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type         text NOT NULL DEFAULT 'general',
  entity_id    uuid,
  entity_type  text,
  content      text,
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_notifier_id ON notifications(notifier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id    ON notifications(actor_id);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own"  ON notifications FOR SELECT USING (auth.uid() = notifier_id);
CREATE POLICY "notif_insert_auth" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notif_update_own"  ON notifications FOR UPDATE USING (auth.uid() = notifier_id);
CREATE POLICY "notif_delete_own"  ON notifications FOR DELETE USING (auth.uid() = notifier_id);
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Triggers for friend notifications
CREATE OR REPLACE FUNCTION notify_friend_request() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE sender_name text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT full_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
    INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
    VALUES (NEW.receiver_id, NEW.sender_id, 'friend_request', NEW.id, 'friendship',
      COALESCE(sender_name, 'Kisi ne') || ' ne aapko friend request bheji')
    ON CONFLICT DO NOTHING;
  END IF; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_friend_request ON friendships;
CREATE TRIGGER trg_notify_friend_request AFTER INSERT ON friendships FOR EACH ROW EXECUTE FUNCTION notify_friend_request();

CREATE OR REPLACE FUNCTION notify_friend_accepted() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE acceptor_name text;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT full_name INTO acceptor_name FROM profiles WHERE id = NEW.receiver_id;
    INSERT INTO notifications (notifier_id, actor_id, type, entity_id, entity_type, content)
    VALUES (NEW.sender_id, NEW.receiver_id, 'friend_accepted', NEW.id, 'friendship',
      COALESCE(acceptor_name, 'Kisi ne') || ' ne aapki friend request accept ki')
    ON CONFLICT DO NOTHING;
  END IF; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_friend_accepted ON friendships;
CREATE TRIGGER trg_notify_friend_accepted AFTER UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION notify_friend_accepted();

-- ── 6. SEEN AT + REPLY ON MESSAGES ──────────────────────────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS seen_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_unseen ON messages(receiver_id, seen_at) WHERE seen_at IS NULL;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ── 7. FRAME REQUESTS (Charity wall) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS frame_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code      text UNIQUE,
  user_id           uuid REFERENCES profiles(id) ON DELETE CASCADE,
  user_name         text,
  user_avatar       text,
  needy_name        text,
  needy_photo_url   text,
  address           text,
  category          text,
  mobile            text,
  description       text,
  collected_amount  numeric DEFAULT 0,
  target_amount     numeric,
  delivery_charge   numeric DEFAULT 0,
  support_count     integer DEFAULT 0,
  status            text DEFAULT 'pending',
  is_priority       boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE frame_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read frame_requests" ON frame_requests FOR SELECT USING (true);
CREATE POLICY "Auth insert frame_requests"   ON frame_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update frame_requests"  ON frame_requests FOR UPDATE USING (auth.uid() = user_id);

-- ── 8. DELETION REQUESTS ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deletion_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  email       text,
  requested_at timestamptz DEFAULT now(),
  status      text DEFAULT 'pending'
);
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read deletion_requests" ON deletion_requests FOR SELECT USING (true);
CREATE POLICY "Auth insert deletion_requests" ON deletion_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
