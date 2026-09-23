-- ── Admin Marketplace ────────────────────────────────────────────────────────
-- Run this once in the Supabase SQL editor.

create table if not exists marketplace_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  price       text,
  image_url   text,
  link_url    text,
  badge       text check (badge in ('New','Sale','Hot') or badge is null),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Only authenticated admins can insert/update/delete; anyone can read active items.
alter table marketplace_items enable row level security;

create policy "marketplace_public_read"
  on marketplace_items for select
  using (is_active = true);

create policy "marketplace_admin_all"
  on marketplace_items for all
  using (auth.email() in ('tiwarijhumki@gmail.com','textilevikhyat@gmail.com'))
  with check (auth.email() in ('tiwarijhumki@gmail.com','textilevikhyat@gmail.com'));

-- Admin can also read inactive items
create policy "marketplace_admin_read_all"
  on marketplace_items for select
  using (auth.email() in ('tiwarijhumki@gmail.com','textilevikhyat@gmail.com'));

-- Enable realtime
do $$ begin
  alter publication supabase_realtime add table marketplace_items;
  exception when duplicate_object then null;
end $$;
