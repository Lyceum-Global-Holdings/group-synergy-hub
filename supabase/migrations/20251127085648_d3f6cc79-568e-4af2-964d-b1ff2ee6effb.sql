-- Add server-side authorization checks to admin-related RPC functions
-- Defense-in-depth: Even though RLS protects the tables, we add function-level checks

-- 1. Fix bootstrap_admin - CRITICAL: Only super admins should be able to create new admins
CREATE OR REPLACE FUNCTION public.bootstrap_admin(_user_id uuid, _role_name text DEFAULT 'Admin'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_role_id uuid;
  caller_is_super_admin boolean;
BEGIN
  -- AUTHORIZATION CHECK: Only super admins can bootstrap other admins
  SELECT is_super_admin(auth.uid()) INTO caller_is_super_admin;
  
  IF NOT caller_is_super_admin THEN
    RAISE EXCEPTION 'Only super administrators can create admin users';
  END IF;
  
  -- Get or create admin role
  SELECT id INTO admin_role_id 
  FROM roles 
  WHERE app_role = 'admin' 
  LIMIT 1;
  
  -- If no admin role exists, create one
  IF admin_role_id IS NULL THEN
    INSERT INTO roles (name, description, app_role)
    VALUES (_role_name, 'System Administrator with full access', 'admin')
    RETURNING id INTO admin_role_id;
  END IF;
  
  -- Assign admin role to user (using INSERT with ON CONFLICT to avoid duplicates)
  INSERT INTO user_roles (user_id, role_id)
  VALUES (_user_id, admin_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
END;
$function$;

-- 2. Fix get_user_company_ids - Only allow users to get their own data, or admins to get anyone's
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid;
  caller_is_admin boolean;
  result uuid[];
BEGIN
  -- Get the calling user's ID
  caller_id := auth.uid();
  
  -- Check if caller is admin
  SELECT is_admin(caller_id) INTO caller_is_admin;
  
  -- AUTHORIZATION CHECK: Users can only get their own company IDs unless they're admin
  IF _user_id != caller_id AND NOT caller_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: You can only access your own company information';
  END IF;
  
  -- Get company IDs
  SELECT ARRAY_AGG(company_id)
  INTO result
  FROM public.profiles
  WHERE user_id = _user_id AND company_id IS NOT NULL;
  
  RETURN result;
END;
$function$;

-- 3. Create a new secure function for admin user management operations
-- This ensures all user management operations have proper authorization
CREATE OR REPLACE FUNCTION public.verify_admin_operation(_operation_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_admin boolean;
BEGIN
  -- Check if the caller is an admin
  SELECT is_admin(auth.uid()) INTO caller_is_admin;
  
  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: % requires administrator privileges', _operation_name;
  END IF;
  
  RETURN true;
END;
$function$;

-- Add comments for documentation
COMMENT ON FUNCTION public.bootstrap_admin IS 'Creates or assigns admin role to a user. Requires super admin privileges.';
COMMENT ON FUNCTION public.get_user_company_ids IS 'Returns company IDs for a user. Users can only access their own data unless they are admins.';
COMMENT ON FUNCTION public.verify_admin_operation IS 'Verifies that the calling user has admin privileges before performing admin operations.';