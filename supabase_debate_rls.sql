-- ============================================================
-- Debate Arena — RLS Policies for debate_challenges
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Enable RLS on debate_challenges (if not already enabled)
alter table if exists debate_challenges enable row level security;

-- 2. Drop any old conflicting policies
drop policy if exists "debate_challenges_select" on debate_challenges;
drop policy if exists "debate_challenges_insert" on debate_challenges;
drop policy if exists "debate_challenges_update" on debate_challenges;
drop policy if exists "allow all debate_challenges" on debate_challenges;

-- 3. SELECT — challenger and responder can read their own debate records
create policy "debate_challenges_select"
on debate_challenges for select
using (
  auth.uid() = challenger_id
  or auth.uid() = responder_id
);

-- 4. INSERT — any authenticated user can issue a challenge
--    (they must be the challenger — enforced in app layer)
create policy "debate_challenges_insert"
on debate_challenges for insert
with check (
  auth.uid() = challenger_id
  and auth.role() = 'authenticated'
);

-- 5. UPDATE — only the challenger or responder can update their debate
create policy "debate_challenges_update"
on debate_challenges for update
using (
  auth.uid() = challenger_id
  or auth.uid() = responder_id
);

-- ============================================================
-- debate_messages — RLS Policies
-- ============================================================

alter table if exists debate_messages enable row level security;

drop policy if exists "debate_messages_select" on debate_messages;
drop policy if exists "debate_messages_insert" on debate_messages;

-- Participants of the debate can read messages
create policy "debate_messages_select"
on debate_messages for select
using (
  exists (
    select 1 from debate_challenges dc
    where dc.id = debate_messages.debate_id
      and (dc.challenger_id = auth.uid() or dc.responder_id = auth.uid())
  )
);

-- Participants can insert messages into their own debate
create policy "debate_messages_insert"
on debate_messages for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from debate_challenges dc
    where dc.id = debate_messages.debate_id
      and (dc.challenger_id = auth.uid() or dc.responder_id = auth.uid())
      and dc.status = 'active'
  )
);

-- ============================================================
-- debate_message_likes — RLS Policies
-- ============================================================

alter table if exists debate_message_likes enable row level security;

drop policy if exists "debate_message_likes_all" on debate_message_likes;

create policy "debate_message_likes_all"
on debate_message_likes for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============================================================
-- Verify (optional sanity check — run separately)
-- ============================================================
-- select tablename, policyname, cmd, qual
-- from pg_policies
-- where tablename in ('debate_challenges','debate_messages','debate_message_likes');
