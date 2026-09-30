-- Run after the main Supabase schema migration.
-- The flag is read by the client for admin UI, while RLS remains authoritative.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Only trusted admins (or server-side SQL/service-role operations with no
-- user JWT) may change the flag. The profiles owner-update policy alone must
-- not allow users to promote themselves.
CREATE OR REPLACE FUNCTION public.guard_profile_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND auth.uid() IS NOT NULL
     AND lower(coalesce(auth.email(), '')) NOT IN (
       'tiwarijhumki@gmail.com',
       'textilevikhyat@gmail.com'
     ) THEN
    RAISE EXCEPTION 'Only trusted admins may change profiles.is_admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_admin_flag ON public.profiles;
CREATE TRIGGER guard_profile_admin_flag
  BEFORE UPDATE OF is_admin ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_admin_flag();

-- Bootstrap the existing configured admin accounts without demoting any
-- other profile flags that may already have been assigned server-side.
UPDATE public.profiles AS profile
SET is_admin = true
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id
  AND lower(auth_user.email) IN (
    'tiwarijhumki@gmail.com',
    'textilevikhyat@gmail.com'
  )
  AND profile.is_admin IS DISTINCT FROM true;

DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_own"
  ON public.posts
  FOR DELETE
  USING (
    auth.uid() = author_id
    OR lower(coalesce(auth.email(), '')) IN (
      'tiwarijhumki@gmail.com',
      'textilevikhyat@gmail.com'
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles AS admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.is_admin = true
    )
  );

COMMIT;