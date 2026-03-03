
CREATE OR REPLACE FUNCTION public.can_access_company(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admins can access all companies
  IF is_super_admin(auth.uid()) THEN
    RETURN TRUE;
  END IF;

  -- Check primary company from profiles
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND company_id = target_company_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check user_company_access table for multi-company memberships
  IF EXISTS (
    SELECT 1 FROM user_company_access
    WHERE user_id = auth.uid()
      AND company_id = target_company_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
