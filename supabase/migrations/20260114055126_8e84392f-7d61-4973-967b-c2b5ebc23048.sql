-- Fix search_path for user_has_company_access function
CREATE OR REPLACE FUNCTION public.user_has_company_access(
  _user_id UUID,
  _company_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_company_access
    WHERE user_id = _user_id AND company_id = _company_id
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = _user_id AND company_id = _company_id
  );
$$;