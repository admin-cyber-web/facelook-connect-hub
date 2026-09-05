-- Dynamic public Showcase Widget
-- Run this once in the Supabase SQL editor for cross-user persistence.

create table if not exists public.showcase_settings (
  id           text primary key default 'global',
  mode         text not null default 'announcement'
               check (mode in ('movie', 'score', 'marketplace', 'announcement')),
  title        text not null default 'Flicks India Showcase',
  body         text not null default 'Stories, moments, and updates worth sharing with the community.',
  image_url    text,
  cta_label    text,
  cta_url      text,
  is_published boolean not null default true,
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

alter table public.showcase_settings enable row level security;

drop policy if exists "Showcase is publicly readable" on public.showcase_settings;
create policy "Showcase is publicly readable"
  on public.showcase_settings
  for select
  using (true);

drop policy if exists "Only designated admins manage showcase" on public.showcase_settings;
create policy "Only designated admins manage showcase"
  on public.showcase_settings
  for all
  using (
    lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'tiwarijhumki@gmail.com',
      'textilevikhyat@gmail.com'
    )
  )
  with check (
    lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'tiwarijhumki@gmail.com',
      'textilevikhyat@gmail.com'
    )
  );

insert into public.showcase_settings (id)
values ('global')
on conflict (id) do nothing;