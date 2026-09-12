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
  with option_counts as (
    select v.survey_id, v.option_id, count(*)::bigint as vote_count
    from public.votes v
    where v.survey_id = any(coalesce(p_survey_ids, '{}'::uuid[]))
    group by v.survey_id, v.option_id
  ),
  survey_totals as (
    select v.survey_id, count(*)::bigint as total_votes
    from public.votes v
    where v.survey_id = any(coalesce(p_survey_ids, '{}'::uuid[]))
    group by v.survey_id
  )
  select oc.survey_id, oc.option_id, oc.vote_count, st.total_votes
  from option_counts oc
  join survey_totals st using (survey_id);
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

grant execute on function public.get_survey_vote_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_trending_surveys(integer) to anon, authenticated;
grant execute on function public.get_survey_engagement_counts(uuid[]) to anon, authenticated;