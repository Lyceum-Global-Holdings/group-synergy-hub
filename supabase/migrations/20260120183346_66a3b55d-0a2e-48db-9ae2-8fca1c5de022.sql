-- Security Hardening Phase 5: Create has_manager_access function first

CREATE OR REPLACE FUNCTION public.has_manager_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND (r.app_role IN ('admin', 'super_admin') 
         OR r.name ILIKE '%manager%'
         OR r.name ILIKE '%hr%'
         OR r.name ILIKE '%director%')
  ) OR public.is_admin(_user_id);
$$;