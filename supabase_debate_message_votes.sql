-- Run this in Supabase SQL Editor to enable message-level verdict voting in DebateArena.
-- Allows viewers to cast Accepted / Rejected verdicts on each argument.

create table if not exists debate_message_votes (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references debate_messages(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  vote_type   text not null check (vote_type in ('accepted', 'rejected')),
  created_at  timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table debate_message_votes enable row level security;

-- Anyone authenticated can vote (one vote per message — enforced by UNIQUE constraint)
create policy "debate vote read"  on debate_message_votes for select using (true);
create policy "debate vote write" on debate_message_votes for insert with check (auth.uid() = user_id);
create policy "debate vote update" on debate_message_votes for update using (auth.uid() = user_id);
create policy "debate vote delete" on debate_message_votes for delete using (auth.uid() = user_id);
