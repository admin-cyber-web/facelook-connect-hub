-- Active Status visibility preference and profile heartbeat.
alter table public.profiles
  add column if not exists active_hide boolean not null default false;

comment on column public.profiles.active_hide is
  'When true, do not publish this profile in application online presence.';

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end
$$;
