-- User offboarding and first-administrator set-up.
--
-- 1. Deleting a user used to remove their profile and roles and then call
--    auth.admin.deleteUser from the browser, which only works with the service
--    role — so the login survived. The new admin-delete-user edge function
--    blocks the login, removes all access, and deletes the login when the user
--    appears on no records. About 100 foreign keys (created_by, approved_by, …)
--    point at auth.users without ON DELETE, so for anyone who has done work the
--    login is kept, blocked, and the profile marked deactivated — the history
--    still shows who did what. These columns record that.
--
-- 2. bootstrap_admin required the caller to already be a super admin, so the
--    "First user? You'll be offered admin setup" path could never work. It also
--    used ON CONFLICT (user_id, role_id), a constraint dropped in 20251216031536
--    (one role per user), so it failed for super admins too. Now:
--      • super admins can still make another user an admin;
--      • the very first account can make itself Super Administrator, but only
--        while no administrator exists AND no other login exists — so an
--        existing user can never use it to take over a populated system.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Deactivated users
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid;

-- Same view as 20260203042254, plus deactivated_at (new columns go last).
CREATE OR REPLACE VIEW public.profiles_directory
WITH (security_invoker = on)
AS
SELECT
  p.id,
  p.user_id,
  -- Email only visible to: profile owner, admins, or super admins
  CASE
    WHEN p.user_id = auth.uid() THEN p.email
    WHEN is_admin(auth.uid()) THEN p.email
    WHEN is_super_admin(auth.uid()) THEN p.email
    ELSE NULL
  END AS email,
  p.full_name,
  p.avatar_url,
  p.role,
  p.department,
  p.company_id,
  p.created_at,
  p.updated_at,
  p.deactivated_at
FROM public.profiles p;

GRANT SELECT ON public.profiles_directory TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. First-administrator set-up
-- ─────────────────────────────────────────────────────────────────────────────

-- True only for the very first account of a fresh system: no administrator
-- exists and no other login exists.
CREATE OR REPLACE FUNCTION public.needs_first_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.user_roles ur
       JOIN public.roles r ON r.id = ur.role_id
       WHERE r.app_role IN ('admin', 'super_admin')
     )
     AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id <> auth.uid())
$$;

REVOKE ALL ON FUNCTION public.needs_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.needs_first_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_admin(_user_id uuid, _role_name text DEFAULT 'Admin'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_role_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '28000';
  END IF;

  -- Super admins can make another user an admin. One role per user, so this
  -- replaces the user's current role.
  IF public.is_super_admin(v_caller) THEN
    SELECT id INTO v_role_id FROM public.roles WHERE app_role = 'admin' ORDER BY created_at LIMIT 1;
    IF v_role_id IS NULL THEN
      INSERT INTO public.roles (name, description, app_role)
      VALUES (_role_name, 'System Administrator with full access', 'admin')
      RETURNING id INTO v_role_id;
    END IF;

    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (_user_id, v_role_id)
    ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id;
    RETURN;
  END IF;

  -- First-time set-up. Serialise concurrent attempts, then re-check.
  PERFORM pg_advisory_xact_lock(hashtext('public.bootstrap_admin'));

  IF _user_id IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'First-time set-up can only promote your own account' USING ERRCODE = '42501';
  END IF;

  IF NOT public.needs_first_admin() THEN
    RAISE EXCEPTION 'An administrator already exists. Ask them to give you access.' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE app_role = 'super_admin' ORDER BY created_at LIMIT 1;
  IF v_role_id IS NULL THEN
    INSERT INTO public.roles (name, description, app_role)
    VALUES ('Super Administrator', 'Full access to every company and setting', 'super_admin')
    RETURNING id INTO v_role_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_caller, v_role_id)
  ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id;

  INSERT INTO public.security_audit_log (changed_by, action, before_value, after_value)
  VALUES (v_caller, 'FIRST_ADMIN_BOOTSTRAP', NULL, jsonb_build_object('user_id', v_caller, 'role_id', v_role_id));
END;
$function$;

COMMENT ON FUNCTION public.bootstrap_admin IS
  'Super admins: make another user an admin. First account of a fresh system (no admins, no other logins): make yourself Super Administrator.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying (expect: true, true, false for you, 0):
--   SELECT
--     (SELECT count(*) = 2 FROM information_schema.columns
--       WHERE table_name = 'profiles' AND column_name IN ('deactivated_at','deactivated_by')) AS columns_added,
--     (SELECT count(*) = 1 FROM information_schema.columns
--       WHERE table_name = 'profiles_directory' AND column_name = 'deactivated_at') AS view_updated,
--     public.needs_first_admin() AS offers_first_admin_setup,
--     (SELECT count(*) FROM public.profiles WHERE deactivated_at IS NOT NULL) AS deactivated_users;
-- ─────────────────────────────────────────────────────────────────────────────
