-- Multi-item public Showcase carousel
-- Run this once in the Supabase SQL editor for cross-user persistence.

create table if not exists public.showcase_settings (
  id             text primary key,
  mode           text not null default 'announcement'
                 check (mode in ('movie', 'score', 'marketplace', 'announcement')),
  title          text not null,
  body           text not null,
  image_url      text,
  cta_label      text,
  cta_url        text,
  is_published   boolean not null default true,
  display_order  integer not null default 0,
  updated_by     uuid references auth.users(id) on delete set null,
  updated_at     timestamptz not null default now()
);

-- Upgrade the previous single-row schema without removing an admin-configured item.
alter table public.showcase_settings
  add column if not exists display_order integer not null default 0;

alter table public.showcase_settings
  alter column id drop default;

-- The earlier migration inserted this exact placeholder row. Remove only that
-- untouched seed so a fresh/empty database has no dummy public banner.
delete from public.showcase_settings
where id = 'global'
  and title = 'Flicks India Showcase'
  and body = 'Stories, moments, and updates worth sharing with the community.'
  and image_url is null
  and cta_label is null
  and cta_url is null
  and is_published = true
  and updated_by is null;

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