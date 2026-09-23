-- Surprise Tagged Reaction
-- Run this migration in the Supabase SQL editor after the friendships table exists.
--
-- The feature stores the public post payload at metadata.surpriseMsg so it
-- remains compatible with the existing posts table shape.

create or replace function public.validate_surprise_tag_friend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  surprise jsonb;
  old_surprise jsonb;
  target_id uuid;
  validate_friend boolean;
begin
  surprise := coalesce(new.metadata, '{}'::jsonb)->'surpriseMsg';
  if surprise is null or surprise = 'null'::jsonb then
    return new;
  end if;

  if jsonb_typeof(surprise) <> 'object' then
    raise exception 'Surprise Tag payload must be a JSON object';
  end if;

  if coalesce(jsonb_typeof(surprise->'targetUserId'), '') <> 'string'
     or coalesce(jsonb_typeof(surprise->'targetUserName'), '') <> 'string'
     or coalesce(jsonb_typeof(surprise->'customMessage'), '') <> 'string'
     or coalesce(jsonb_typeof(surprise->'gifUrl'), '') <> 'string'
     or coalesce(jsonb_typeof(surprise->'isSeen'), '') <> 'boolean' then
    raise exception 'Surprise Tag payload has an invalid JSON structure';
  end if;

  if btrim(surprise->>'targetUserName') = ''
     or btrim(surprise->>'customMessage') = '' then
    raise exception 'Surprise Tag target name and custom message are required';
  end if;

  begin
    target_id := nullif(surprise->>'targetUserId', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Surprise Tag targetUserId must be a valid user id';
  end;

  if target_id is null then
    raise exception 'Surprise Tags must target a connected friend';
  end if;

  if tg_op = 'UPDATE' then
    old_surprise := coalesce(old.metadata, '{}'::jsonb)->'surpriseMsg';
  else
    old_surprise := null;
  end if;

  -- The recipient's one-time isSeen update is allowed without re-checking
  -- friendship. Any new tag target or author change must pass the friend check.
  validate_friend := tg_op = 'INSERT'
    or old_surprise is null
    or old_surprise->>'targetUserId' is distinct from surprise->>'targetUserId'
    or old.author_id is distinct from new.author_id;

  if validate_friend and surprise->>'isSeen' <> 'false' then
    raise exception 'New Surprise Tags must start with isSeen=false';
  end if;

  if validate_friend and (
    target_id = new.author_id
    or not exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = new.author_id and f.receiver_id = target_id)
          or
          (f.sender_id = target_id and f.receiver_id = new.author_id)
        )
    )
  ) then
    raise exception 'Surprise Tags are limited to connected friends';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_surprise_tag_friend_on_posts on public.posts;
create trigger validate_surprise_tag_friend_on_posts
before insert or update of metadata, author_id on public.posts
for each row
execute function public.validate_surprise_tag_friend();

create or replace function public.mark_surprise_message_seen(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.posts
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{surpriseMsg,isSeen}',
    'true'::jsonb,
    true
  )
  where id = p_post_id
    and coalesce(metadata, '{}'::jsonb)->'surpriseMsg'->>'targetUserId' = auth.uid()::text
    and coalesce(metadata, '{}'::jsonb)->'surpriseMsg'->>'isSeen' = 'false';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.mark_surprise_message_seen(uuid) from public;
grant execute on function public.mark_surprise_message_seen(uuid) to authenticated;