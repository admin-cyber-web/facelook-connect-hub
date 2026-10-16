-- Adds persistent profile cover images for the Profile Timeline.
alter table public.profiles
  add column if not exists cover_url text;
