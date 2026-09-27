-- The WISHOP console acts on every shop (plans, suspension, deletion): it
-- now requires a second factor, a 6-digit code from an authenticator app,
-- on top of the password (review of 26/09/2026). A stolen password alone no
-- longer opens it, not even by calling the database directly.
--
-- is_platform_admin(): what every admin_* function checks. True only for a
--   listed admin whose session passed the code (Supabase Auth "aal2").
-- is_platform_admin_account(): listed admin, whatever the session. The app
--   uses it to show the console entry, then asks for the code there
--   (features/admin/components/AdminMfaGate.tsx).

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
       AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin_account()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin_account() TO authenticated;
