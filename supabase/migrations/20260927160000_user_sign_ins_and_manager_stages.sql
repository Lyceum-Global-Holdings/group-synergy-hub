-- 1. Last sign-in times for Users & Roles.
--    The list read profiles only, so every user showed "Inactive" and "Never".
--    Sign-in times live in auth.users, which the browser cannot read; this
--    returns them to administrators, for users in companies they can access.
--
-- 2. "moderator" was never a role level in this system (app_role is super_admin,
--    admin, manager, user, supplier). The default supplier-approval stages 2 and
--    3 required 'moderator', so they could never find an approver. The mid level
--    is 'manager'.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Sign-in times
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_user_sign_ins()
RETURNS TABLE (user_id uuid, last_sign_in_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.last_sign_in_at
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE public.is_admin(auth.uid())
    AND (
      public.is_super_admin(auth.uid())
      OR p.company_id IS NULL
      OR public.can_access_company(p.company_id)
    )
$$;

REVOKE ALL ON FUNCTION public.admin_user_sign_ins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_sign_ins() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Approval stages: 'moderator' → 'manager'
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.approval_stages
   SET required_role = 'manager'
 WHERE required_role = 'moderator';

-- Same as 20251021065556 (search_path from 20251127052005), with 'manager'.
CREATE OR REPLACE FUNCTION public.create_default_approval_stages()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default approval stages for new company
  INSERT INTO public.approval_stages (company_id, stage_order, stage_name, stage_description, required_role, escalation_days)
  VALUES
    (NEW.id, 1, 'Initial Review', 'Verify supplier information and documents', 'user', 3),
    (NEW.id, 2, 'Procurement Approval', 'Review supplier fit and requirements', 'manager', 2),
    (NEW.id, 3, 'Finance Review', 'Verify banking details and credit terms', 'manager', 2),
    (NEW.id, 4, 'Final Approval', 'Executive sign-off for high-value suppliers', 'admin', 1);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying (expect: true, 0):
--   SELECT
--     (SELECT count(*) > 0 FROM public.admin_user_sign_ins() WHERE last_sign_in_at IS NOT NULL) AS sign_ins_visible,
--     (SELECT count(*) FROM public.approval_stages WHERE required_role = 'moderator') AS moderator_stages_left;
--   The first value is only true when run as an admin from the app; in the SQL
--   editor (no signed-in user) it returns false — use the second value there.
-- ─────────────────────────────────────────────────────────────────────────────
