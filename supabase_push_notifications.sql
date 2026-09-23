-- ═══════════════════════════════════════════════════════════════════════════
--  FLICKS INDIA — OneSignal Push Notifications Setup
--  Run once in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Add OneSignal player/subscription ID column to profiles
alter table profiles
  add column if not exists onesignal_player_id text;

-- 2) Allow authenticated users to update their own onesignal_player_id
--    (The existing "Owner update profile" policy already covers this,
--     but create a targeted policy if you ever restrict the update policy.)

-- 3) Index for fast lookup when sending notifications
create index if not exists profiles_onesignal_player_id_idx
  on profiles (onesignal_player_id)
  where onesignal_player_id is not null;

-- ───────────────────────────────────────────────────────────────────────────
-- NEXT STEPS (do these in the Supabase Dashboard):
--
-- A) Add Edge Function secret:
--    Dashboard → Edge Functions → Manage secrets → Add:
--      ONESIGNAL_REST_API_KEY = <your OneSignal REST API key>
--
-- B) Deploy the edge function (from terminal with Supabase CLI):
--      supabase functions deploy push-notify --no-verify-jwt
--
-- C) Create two Database Webhooks:
--    Dashboard → Database → Webhooks → Create a new hook
--
--    Hook 1 — New Message:
--      Name:   on_new_message
--      Table:  public.messages
--      Events: INSERT
--      Type:   Supabase Edge Functions
--      Function: push-notify
--
--    Hook 2 — New Like:
--      Name:   on_new_like
--      Table:  public.likes
--      Events: INSERT
--      Type:   Supabase Edge Functions
--      Function: push-notify
-- ═══════════════════════════════════════════════════════════════════════════
