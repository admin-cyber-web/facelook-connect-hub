-- Focused Step 2 egress patch.
-- Run only after checking the deployed survey schema and existing policies.
-- These are SECURITY INVOKER read functions: existing RLS/public-read rules
-- continue to apply, and no old migration is replayed.

create or replace function public.get_survey_vote_counts(p_survey_ids uuid[])
returns table (
  survey_id uuid,
  option_id uuid,
  vote_count bigint,
  total_votes bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_survey_ids, '{}'::uuid[])) as survey_id
  ),
  option_counts as (
    select v.survey_id, v.option_id, count(*)::bigint as vote_count
    from public.votes v
    join requested r on r.survey_id = v.survey_id
    group by v.survey_id, v.option_id
  ),
  survey_totals as (
    select v.survey_id, count(*)::bigint as total_votes
    from public.votes v
    join requested r on r.survey_id = v.survey_id
    group by v.survey_id
  )
  select so.survey_id,
         so.id as option_id,
         coalesce(oc.vote_count, 0)::bigint as vote_count,
         coalesce(st.total_votes, 0)::bigint as total_votes
  from public.survey_options so
  join requested r on r.survey_id = so.survey_id
  left join option_counts oc
    on oc.survey_id = so.survey_id
   and oc.option_id = so.id
  left join survey_totals st on st.survey_id = so.survey_id;
$$;

create or replace function public.get_trending_surveys(p_limit integer default 3)
returns table (survey_id uuid, total_votes bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select v.survey_id, count(*)::bigint as total_votes
  from public.votes v
  where exists (
    select 1
    from public.surveys s
    where s.id = v.survey_id
  )
  group by v.survey_id
  order by total_votes desc, v.survey_id
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

create or replace function public.get_survey_engagement_counts(p_survey_ids uuid[])
returns table (survey_id uuid, likes_count bigint, comments_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select unnest(coalesce(p_survey_ids, '{}'::uuid[])) as survey_id
  ),
  likes as (
    select sl.survey_id, count(*)::bigint as likes_count
    from public.survey_likes sl
    where sl.survey_id = any(coalesce(p_survey_ids, '{}'::uuid[]))
    group by sl.survey_id
  ),
  comments as (
    select sc.survey_id, count(*)::bigint as comments_count
    from public.survey_comments sc
    where sc.survey_id = any(coalesce(p_survey_ids, '{}'::uuid[]))
    group by sc.survey_id
  )
  select r.survey_id,
         coalesce(l.likes_count, 0),
         coalesce(c.comments_count, 0)
  from requested r
  left join likes l using (survey_id)
  left join comments c using (survey_id);
$$;

create or replace function public.get_post_engagement_counts(
  p_post_ids uuid[],
  p_viewer_id uuid default null
)
returns table (
  post_id uuid,
  likes_count bigint,
  comments_count bigint,
  shares_count bigint,
  liked_by_me boolean,
  reaction_type text
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_post_ids, '{}'::uuid[])) as post_id
  )
  select r.post_id,
         coalesce((select count(*) from public.likes l where l.post_id = r.post_id), 0)::bigint,
         coalesce((select count(*) from public.comments c where c.post_id = r.post_id), 0)::bigint,
         coalesce((select count(*) from public.shares s where s.post_id = r.post_id), 0)::bigint,
         exists (
           select 1
           from public.likes l
           where l.post_id = r.post_id
             and p_viewer_id is not null
             and l.user_id = p_viewer_id
         ),
         (
           select l.reaction_type::text
           from public.likes l
           where l.post_id = r.post_id
             and p_viewer_id is not null
             and l.user_id = p_viewer_id
           limit 1
         )
  from requested r;
$$;

create or replace function public.get_page_follower_counts(p_page_ids uuid[])
returns table (page_id uuid, follower_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select pf.page_id, count(*)::bigint
  from public.page_followers pf
  where pf.page_id = any(coalesce(p_page_ids, '{}'::uuid[]))
  group by pf.page_id;
$$;

create or replace function public.get_circle_member_counts(p_circle_ids uuid[])
returns table (circle_id uuid, member_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select cm.circle_id, count(*)::bigint
  from public.circle_members cm
  where cm.circle_id = any(coalesce(p_circle_ids, '{}'::uuid[]))
  group by cm.circle_id;
$$;

grant execute on function public.get_survey_vote_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_trending_surveys(integer) to anon, authenticated;
grant execute on function public.get_survey_engagement_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_post_engagement_counts(uuid[], uuid) to anon, authenticated;
grant execute on function public.get_page_follower_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_circle_member_counts(uuid[]) to anon, authenticated;