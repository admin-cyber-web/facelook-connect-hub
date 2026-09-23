-- ============================================================
-- PRIVATE PROFILE SEARCH + CHAT GUARD
-- Keeps private profiles out of search unless the viewer is an
-- accepted friend or shares an accepted mutual connection.
-- ============================================================

create or replace function public.can_view_private_profile(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_target_user_id = auth.uid()
    or coalesce(
      (select p.is_private_mode from public.profiles p where p.id = p_target_user_id),
      false
    ) = false
    or exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = auth.uid() and f.receiver_id = p_target_user_id)
          or
          (f.sender_id = p_target_user_id and f.receiver_id = auth.uid())
        )
    )
    or exists (
      select 1
      from public.friendships viewer_edge
      join public.friendships candidate_edge
        on viewer_edge.status = 'accepted'
       and candidate_edge.status = 'accepted'
       and (
         case
           when viewer_edge.sender_id = auth.uid() then viewer_edge.receiver_id
           else viewer_edge.sender_id
         end
       ) = (
         case
           when candidate_edge.sender_id = p_target_user_id then candidate_edge.receiver_id
           else candidate_edge.sender_id
         end
       )
      where (viewer_edge.sender_id = auth.uid() or viewer_edge.receiver_id = auth.uid())
        and (
          candidate_edge.sender_id = p_target_user_id
          or candidate_edge.receiver_id = p_target_user_id
        )
    );
$$;

revoke all on function public.can_view_private_profile(uuid) from public;
grant execute on function public.can_view_private_profile(uuid) to authenticated;

create or replace function public.search_visible_profiles(
  p_query text,
  p_limit integer
)
returns table (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  fame_points integer,
  last_seen timestamptz,
  is_private_mode boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.fame_points,
    p.last_seen,
    coalesce(p.is_private_mode, false)
  from public.profiles p
  where p.id <> auth.uid()
    and coalesce(p.profile_hidden, false) = false
    and (
      nullif(trim(coalesce(p_query, '')), '') is null
      or p.full_name ilike '%' || trim(p_query) || '%'
      or p.username ilike '%' || trim(p_query) || '%'
    )
    and public.can_view_private_profile(p.id)
  order by coalesce(p.fame_points, 0) desc, p.full_name nulls last, p.id
  limit greatest(least(coalesce(p_limit, 20), 50), 1);
$$;

revoke all on function public.search_visible_profiles(text, integer) from public;
grant execute on function public.search_visible_profiles(text, integer) to authenticated;

-- Public profiles continue to support message requests. Private profiles
-- require the same friend/mutual-connection check as search.
drop policy if exists "Read own messages" on public.messages;
drop policy if exists "Send message" on public.messages;
drop policy if exists "Users can read own messages" on public.messages;
drop policy if exists "Users can insert own messages" on public.messages;

create policy "Read own messages"
  on public.messages for select
  using (
    auth.uid() = receiver_id
    or (
      auth.uid() = sender_id
      and public.can_view_private_profile(receiver_id)
    )
  );

create policy "Send message"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and public.can_view_private_profile(receiver_id)
  );