-- First, let's create a function to safely bootstrap the first admin user
CREATE OR REPLACE FUNCTION public.bootstrap_admin(_user_id uuid, _role_name text DEFAULT 'Admin')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role_id uuid;
BEGIN
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
$$;

-- Create a more flexible RLS policy for user_roles that allows bootstrapping
DROP POLICY IF EXISTS "Only admins can modify user roles" ON public.user_roles;

CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
USING (
  -- Allow if user is admin OR if this is the first user being created (bootstrap scenario)
  is_admin(auth.uid()) OR 
  (
    -- Allow if no admin users exist yet (bootstrap scenario)
    NOT EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE r.app_role = 'admin'
    )
  )
)
WITH CHECK (
  -- Same check for insert/update
  is_admin(auth.uid()) OR 
  (
    NOT EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE r.app_role = 'admin'
    )
  )
);

-- Also update the profiles table to allow admin users to view all profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id OR is_admin(auth.uid())
);

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create a function to handle the complete user creation flow
CREATE OR REPLACE FUNCTION public.create_user_with_roles(
  _email text,
  _password text,
  _full_name text,
  _department text DEFAULT NULL,
  _role_ids uuid[] DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
  role_id uuid;
  result json;
BEGIN
  -- This function will be called from an Edge Function
  -- For now, return the parameters so the frontend can handle the auth creation
  result := json_build_object(
    'email', _email,
    'full_name', _full_name,
    'department', _department,
    'role_ids', _role_ids
  );
  
  RETURN result;
END;
$$;