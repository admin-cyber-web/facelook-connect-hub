-- ═══════════════════════════════════════════════════════════════════════════════
-- Safety & Integrity Engine — run once in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. User Risk Profiles ─────────────────────────────────────────────────────
create table if not exists user_risk_profiles (
  user_id        uuid primary key references profiles(id) on delete cascade,
  risk_score     int          not null default 0,
  is_flagged     boolean      not null default false,
  last_reset_at  timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);
alter table user_risk_profiles enable row level security;

-- Anyone can read (receiver must check the sender's flag)
create policy "read risk profiles"   on user_risk_profiles for select using (true);
-- Only the user themselves can write their own row
create policy "upsert own risk"      on user_risk_profiles for insert with check (auth.uid() = user_id);
create policy "update own risk"      on user_risk_profiles for update using  (auth.uid() = user_id);

-- ── 2. Love Protect Links ─────────────────────────────────────────────────────
create table if not exists love_protect_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  partner_id  uuid        not null references profiles(id) on delete cascade,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  unique(user_id)
);
alter table love_protect_links enable row level security;
create policy "own love protect" on love_protect_links for all using (auth.uid() = user_id);

-- ── 3. Safety Notifications (system-generated, not chat messages) ─────────────
create table if not exists safety_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  type        text        not null,  -- 'suspicious_activity' | 'love_protect'
  message     text        not null,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now()
);
alter table safety_notifications enable row level security;
create policy "own safety notifs" on safety_notifications for all using (auth.uid() = user_id);

-- ── 4. Message History (explicit audit log; normal messages table also serves this)
create table if not exists message_history (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid        not null references profiles(id) on delete cascade,
  receiver_id     uuid        not null references profiles(id) on delete cascade,
  message_content text,
  has_risk_flag   boolean     not null default false,
  created_at      timestamptz not null default now()
);
alter table message_history enable row level security;
create policy "own message history" on message_history for all using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- ── 5. Risk score decay — run weekly via pg_cron (optional) ──────────────────
-- SELECT cron.schedule('weekly-risk-decay', '0 0 * * 0',
--   $$UPDATE user_risk_profiles
--     SET risk_score  = GREATEST(0, risk_score - 20),
--         is_flagged  = (GREATEST(0, risk_score - 20) > 50),
--         last_reset_at = now()
--     WHERE last_reset_at < now() - interval '7 days'$$
-- );

-- ── 6. Helper index ───────────────────────────────────────────────────────────
create index if not exists idx_message_history_sender    on message_history(sender_id, created_at desc);
create index if not exists idx_safety_notifs_user        on safety_notifications(user_id, created_at desc);
create index if not exists idx_love_protect_user         on love_protect_links(user_id) where is_active;
