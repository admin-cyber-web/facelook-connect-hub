-- Reels-only like hardening.
--
-- The app calls toggle_reel_like only for video/reel cards. Normal post-like
-- handlers are intentionally unchanged. The likes table already models the
-- invariant as one row per (post_id, user_id); this migration repairs any
-- legacy duplicates before making that invariant explicit.

begin;

-- Keep the oldest row if legacy data contains duplicate likes.
delete from public.likes duplicate_row
using public.likes kept_row
where duplicate_row.post_id = kept_row.post_id
  and duplicate_row.user_id = kept_row.user_id
  and duplicate_row.id > kept_row.id;

create unique index if not exists likes_post_user_unique_idx
  on public.likes (post_id, user_id);

create or replace function public.toggle_reel_like(p_post_id uuid)
returns table (liked boolean, likes_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_liked boolean;
  next_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Keep this RPC scoped to media rows that the Reels UI can render. The
  -- client also filters these rows before exposing the button.
  if not exists (
    select 1
    from public.posts
    where id = p_post_id
      and media_url is not null
      and (
        lower(coalesce(type, '')) in ('reel', 'video')
        or media_url ~* '(mp4|webm|ogg|mov|m4v)'
        or media_url ~* '(youtube[.]com|youtu[.]be|rapidcdn[.]app)'
      )
  ) then
    raise exception 'Post is not a reel';
  end if;

  if exists (
    select 1
    from public.likes
    where post_id = p_post_id
      and user_id = auth.uid()
  ) then
    delete from public.likes
    where post_id = p_post_id
      and user_id = auth.uid();
    next_liked := false;
  else
    insert into public.likes (post_id, user_id)
    values (p_post_id, auth.uid())
    on conflict (post_id, user_id) do nothing;
    next_liked := true;
  end if;

  select count(*)::integer
    into next_count
    from public.likes
   where post_id = p_post_id;

  -- Security-definer avoids the normal author-only posts UPDATE policy while
  -- keeping this write limited to the reel row passed to this RPC.
  update public.posts
     set likes_count = next_count
   where id = p_post_id;

  return query select next_liked, next_count;
end;
$$;

revoke all on function public.toggle_reel_like(uuid) from public;
grant execute on function public.toggle_reel_like(uuid) to authenticated;

commit;