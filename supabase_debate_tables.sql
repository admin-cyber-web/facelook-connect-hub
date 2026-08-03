-- ═══════════════════════════════════════════════════════════════════════════════
-- supabase_debate_tables.sql
-- Run this entire file once in your Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. debate_challenges ──────────────────────────────────────────────────────
create table if not exists debate_challenges (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid not null references surveys(id)    on delete cascade,
  challenger_id uuid not null references auth.users(id) on delete cascade,
  responder_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending',        -- pending|active|rejected|finished|expired
  is_public     boolean not null default false,
  expires_at    timestamptz not null default (now() + interval '48 hours'),
  finished_at   timestamptz,
  winner_id     uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  constraint debate_status_check
    check (status in ('pending','active','rejected','finished','expired'))
);

alter table debate_challenges enable row level security;

-- only participants can see their debate
create policy "debate: participants select"
  on debate_challenges for select
  using (auth.uid() = challenger_id or auth.uid() = responder_id);

-- challenger creates the row
create policy "debate: challenger insert"
  on debate_challenges for insert
  with check (auth.uid() = challenger_id);

-- participants update (accept / reject / finish / make public)
create policy "debate: participants update"
  on debate_challenges for update
  using (auth.uid() = challenger_id or auth.uid() = responder_id);

-- ── 2. debate_messages ────────────────────────────────────────────────────────
create table if not exists debate_messages (
  id          uuid primary key default gen_random_uuid(),
  debate_id   uuid not null references debate_challenges(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  likes_count int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table debate_messages enable row level security;

create policy "debate_messages: participants select"
  on debate_messages for select
  using (
    exists (
      select 1 from debate_challenges dc
      where dc.id = debate_id
        and (dc.challenger_id = auth.uid() or dc.responder_id = auth.uid())
    )
  );

create policy "debate_messages: participants insert"
  on debate_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from debate_challenges dc
      where dc.id = debate_id
        and (dc.challenger_id = auth.uid() or dc.responder_id = auth.uid())
        and dc.status = 'active'
    )
  );

create policy "debate_messages: owner delete"
  on debate_messages for delete
  using (auth.uid() = user_id);

-- ── 3. debate_message_likes ───────────────────────────────────────────────────
create table if not exists debate_message_likes (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references debate_messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id)      on delete cascade,
  unique(message_id, user_id)
);

alter table debate_message_likes enable row level security;

create policy "debate_likes: public read"  on debate_message_likes for select using (true);
create policy "debate_likes: auth insert"  on debate_message_likes for insert with check (auth.uid() = user_id);
create policy "debate_likes: owner delete" on debate_message_likes for delete using (auth.uid() = user_id);

-- ── 4. Debater Level on profiles ─────────────────────────────────────────────
alter table profiles add column if not exists debater_level int not null default 0;

-- ── 5. Indexes ────────────────────────────────────────────────────────────────
create index if not exists idx_debate_challenger on debate_challenges(challenger_id);
create index if not exists idx_debate_responder  on debate_challenges(responder_id);
create index if not exists idx_debate_survey     on debate_challenges(survey_id);
create index if not exists idx_debate_messages   on debate_messages(debate_id);
create index if not exists idx_debate_likes      on debate_message_likes(message_id);

-- ── 6. Enable Realtime ────────────────────────────────────────────────────────
alter publication supabase_realtime add table debate_challenges;
alter publication supabase_realtime add table debate_messages;
