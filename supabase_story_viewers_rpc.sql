-- RPC: get_story_viewers_list
-- Returns a flat list of viewers for a given story with profile data joined server-side.
-- Run this once in the Supabase SQL editor.

create or replace function get_story_viewers_list(p_story_id uuid)
returns table (
  viewer_id  uuid,
  viewed_at  timestamptz,
  full_name  text,
  username   text,
  avatar_url text
)
language sql
security definer
stable
as $$
  select
    sv.viewer_id,
    sv.viewed_at,
    coalesce(p.full_name, 'User') as full_name,
    p.username,
    p.avatar_url
  from story_views sv
  left join profiles p on p.id = sv.viewer_id
  where sv.story_id = p_story_id
  order by sv.viewed_at desc;
$$;

-- Allow authenticated users to call this function
grant execute on function get_story_viewers_list(uuid) to authenticated;
