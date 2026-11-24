-- ═══════════════════════════════════════════════════════════════════════════
--  FLICKS: Post Report & Moderation Review Notifications with Deep-Linking
--  Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ensure notifications table has metadata column for rich content
--    (entity_type = 'post', entity_id = <post_id>, type = 'post_reported' | 'post_moderation_review')
alter table public.notifications
  add column if not exists metadata jsonb;

-- Index for efficient querying by entity
create index if not exists idx_notifications_entity
  on public.notifications(entity_type, entity_id);

-- 2. Ensure reports table has all required columns for notification triggers
--    (add post_author_id for direct access without join, review_note for moderation notes)
alter table public.reports
  add column if not exists post_author_id uuid references auth.users(id) on delete cascade,
  add column if not exists review_note text,
  add column if not exists review_decision text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists idx_reports_post_author_id on public.reports(post_author_id);

-- 3. Function to get reporter name (for notification content)
create or replace function public.get_reporter_name(reporter_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter_name text;
begin
  select coalesce(full_name, username, 'Someone')
  into reporter_name
  from public.profiles
  where id = reporter_id;
  return reporter_name;
end;
$$;

-- 4. Function to get post author name
create or replace function public.get_post_author_name(author_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  author_name text;
begin
  select coalesce(full_name, username, 'Someone')
  into author_name
  from public.profiles
  where id = author_id;
  return author_name;
end;
$$;

-- 5. Function to get post preview snippet (first 100 chars of content)
create or replace function public.get_post_preview(post_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  preview text;
begin
  select case
    when content is not null and content != '' then left(content, 100)
    when media_url is not null then '[Media post]'
    else '[Empty post]'
  end
  into preview
  from public.posts
  where id = post_id;
  
  if preview is null then
    select case
      when content is not null and content != '' then left(content, 100)
      when media_url is not null then '[Media post]'
      else '[Empty post]'
    end
    into preview
    from public.flicks
    where id = post_id;
  end if;
  
  return coalesce(preview, '[Post not found]');
end;
$$;

-- 6. TRIGGER: Notify post owner when their post is reported
--    Runs AFTER INSERT on reports table
create or replace function public.notify_post_reported()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author_id uuid;
  v_reporter_name text;
  v_post_preview text;
  v_report_reason text;
  v_notification_content text;
  v_metadata jsonb;
begin
  -- Only process post reports (not user reports)
  if new.post_id is null then
    return new;
  end if;

  -- Get the post author (the person being notified)
  select author_id into v_post_author_id
  from public.posts
  where id = new.post_id;

  -- If post not found in posts table, check flicks table
  if v_post_author_id is null then
    select author_id into v_post_author_id
    from public.flicks
    where id = new.post_id;
  end if;

  -- If still no author found, nothing to notify
  if v_post_author_id is null then
    return new;
  end if;

  -- Don't notify if the reporter is the post author (self-report)
  if v_post_author_id = new.reporter_id then
    return new;
  end if;

  -- Get reporter name
  v_reporter_name := public.get_reporter_name(new.reporter_id);

  -- Get post preview
  v_post_preview := public.get_post_preview(new.post_id);

  -- Get report reason
  v_report_reason := new.reason;

  -- Build notification content
  v_notification_content := format(
    '%s reported your post to the Flicks Team. Reason: %s',
    v_reporter_name,
    v_report_reason
  );

  -- Build metadata for deep-linking and rich display
  v_metadata := jsonb_build_object(
    'report_id', new.id,
    'reporter_id', new.reporter_id,
    'reporter_name', v_reporter_name,
    'report_reason', v_report_reason,
    'post_preview', v_post_preview,
    'reported_at', new.created_at,
    'entity_type', 'post',
    'entity_id', new.post_id
  );

  -- Insert notification for the post owner
  insert into public.notifications (notifier_id, actor_id, type, entity_id, entity_type, content, metadata, is_read)
  values (
    v_post_author_id,           -- post owner receives notification
    new.reporter_id,            -- reporter triggered it
    'post_reported',            -- notification type
    new.post_id,                -- entity_id = post_id
    'post',                     -- entity_type = 'post'
    v_notification_content,     -- human-readable message
    v_metadata,                 -- rich metadata
    false                       -- unread
  ) on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_notify_post_reported on public.reports;
create trigger trg_notify_post_reported
  after insert on public.reports
  for each row
  execute function public.notify_post_reported();


-- 7. TRIGGER: Notify post owner when moderation review is completed
--    Runs AFTER UPDATE on reports table when status changes to 'resolved'
--    Uses same notification types as AdminDashboard manual actions:
--    - Safe/No Violation: report_resolved_safe (reporter) + post_moderation_safe (author)
--    - Removed/Violation: report_resolved_removed (reporter) + report_post_removed (author)
--    - Cleaned: report_resolved_cleaned (reporter) + report_post_cleaned (author)
create or replace function public.notify_post_moderation_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author_id uuid;
  v_reviewer_name text;
  v_post_preview text;
  v_notification_content text;
  v_metadata jsonb;
  v_decision text;
  v_review_note text;
  v_reporter_notif_type text;
  v_author_notif_type text;
begin
  -- Only process when report is resolved (status changed to 'resolved')
  if new.status != 'resolved' or old.status = 'resolved' then
    return new;
  end if;

  -- Only process post reports (not user reports)
  if new.post_id is null then
    return new;
  end if;

  -- Get the post author (the person being notified)
  select author_id into v_post_author_id
  from public.posts
  where id = new.post_id;

  -- If post not found in posts table, check flicks table
  if v_post_author_id is null then
    select author_id into v_post_author_id
    from public.flicks
    where id = new.post_id;
  end if;

  -- If still no author found, nothing to notify
  if v_post_author_id is null then
    return new;
  end if;

  -- Get reviewer name (the admin/moderator who reviewed)
  v_reviewer_name := public.get_reporter_name(coalesce(new.reviewed_by, new.reporter_id));

  -- Get post preview
  v_post_preview := public.get_post_preview(new.post_id);

  -- Get decision and review note
  v_decision := coalesce(new.review_decision, new.decision, 'Reviewed');
  v_review_note := new.review_note;

  -- Determine notification types based on decision (matching AdminDashboard logic)
  if v_decision ilike '%safe%' or v_decision ilike '%no violation%' then
    -- Safe/No Violation
    v_reporter_notif_type := 'report_resolved_safe';
    v_author_notif_type := 'post_moderation_safe';
    v_notification_content := format(
      'Your post was reviewed by the Flicks community and considered safe. You can continue posting.%s',
      case when v_review_note is not null and v_review_note != '' 
        then format(' Review note: %s', v_review_note)
        else ''
      end
    );
  elsif v_decision ilike '%clean%' then
    -- Content Cleaned
    v_reporter_notif_type := 'report_resolved_cleaned';
    v_author_notif_type := 'report_post_cleaned';
    v_notification_content := format(
      'Someone reported your post. After review, its content was cleaned to follow guidelines.%s',
      case when v_review_note is not null and v_review_note != '' 
        then format(' Reason: %s', v_review_note)
        else ''
      end
    );
  else
    -- Violation/Removed
    v_reporter_notif_type := 'report_resolved_removed';
    v_author_notif_type := 'report_post_removed';
    v_notification_content := format(
      'Your post was reviewed and found to violate community guidelines. Decision: %s.%s',
      v_decision,
      case when v_review_note is not null and v_review_note != '' 
        then format(' Reason: %s', v_review_note)
        else ''
      end
    );
  end if;

  -- Build metadata for deep-linking and rich display
  v_metadata := jsonb_build_object(
    'report_id', new.id,
    'reviewer_id', new.reviewed_by,
    'reviewer_name', v_reviewer_name,
    'decision', v_decision,
    'review_note', v_review_note,
    'post_preview', v_post_preview,
    'reviewed_at', new.reviewed_at,
    'entity_type', 'post',
    'entity_id', new.post_id
  );

  -- Insert notification for the post author
  insert into public.notifications (notifier_id, actor_id, type, entity_id, entity_type, content, metadata, is_read)
  values (
    v_post_author_id,
    coalesce(new.reviewed_by, new.reporter_id),
    v_author_notif_type,
    new.post_id,
    'post',
    v_notification_content,
    v_metadata,
    false
  ) on conflict do nothing;

  -- Insert notification for the reporter (if different from post author)
  if new.reporter_id != v_post_author_id then
    insert into public.notifications (notifier_id, actor_id, type, entity_id, entity_type, content, metadata, is_read)
    values (
      new.reporter_id,
      coalesce(new.reviewed_by, new.reporter_id),
      v_reporter_notif_type,
      new.post_id,
      'post',
      case 
        when v_reporter_notif_type = 'report_resolved_safe' 
        then 'Your report was reviewed — the post was found safe.'
        when v_reporter_notif_type = 'report_resolved_removed'
        then 'Your report was reviewed — the post was removed.'
        when v_reporter_notif_type = 'report_resolved_cleaned'
        then 'Your report was reviewed — the post was cleaned of violations.'
      end,
      v_metadata,
      false
    ) on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_post_moderation_review on public.reports;
create trigger trg_notify_post_moderation_review
  after update on public.reports
  for each row
  execute function public.notify_post_moderation_review();


-- 8. BACKFILL: Update existing reports with post_author_id for faster lookups
--    (Run this once after creating the column)
update public.reports r
set post_author_id = p.author_id
from public.posts p
where r.post_id = p.id
  and r.post_author_id is null;

update public.reports r
set post_author_id = f.author_id
from public.flicks f
where r.post_id = f.id
  and r.post_author_id is null;


-- 9. VERIFICATION QUERIES (run after migration to confirm)
/*
-- Check reports table has new columns
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'reports'
order by ordinal_position;

-- Check notifications table has metadata column
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'notifications'
and column_name = 'metadata';

-- Check triggers exist
select trigger_name, event_manipulation, event_object_table
from information_schema.triggers
where trigger_name in ('trg_notify_post_reported', 'trg_notify_post_moderation_review');

-- Test: Insert a report and verify notification created
-- (Replace UUIDs with actual values)
-- insert into public.reports (reporter_id, post_id, reason) values ('...', '...', 'Test reason');
-- select * from public.notifications where type = 'post_reported' order by created_at desc limit 5;

-- Test: Update report to resolved and verify notification created
-- update public.reports set status = 'resolved', decision = 'No Violation', review_note = 'Content is safe', reviewed_by = '...', reviewed_at = now() where id = '...';
-- select * from public.notifications where type = 'post_moderation_review' order by created_at desc limit 5;
*/