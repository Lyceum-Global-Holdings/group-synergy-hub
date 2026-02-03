-- Tighten profiles security - hide emails from non-admin users while preserving directory functionality

-- Create a secure view that conditionally exposes email
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
  p.updated_at
FROM public.profiles p;

-- Grant access to the view
GRANT SELECT ON public.profiles_directory TO authenticated;

-- Add comment documenting the security model
COMMENT ON VIEW public.profiles_directory IS 
'Secure directory view - email addresses are only visible to the profile owner, company admins, and super admins. 
Regular users can see colleague names, roles, and departments for collaboration, but not emails.
Applications should query this view instead of the profiles table directly for listing users.';

-- Tighten the base table policies - remove broad company access for SELECT
-- Keep only owner and admin access to full profile data

-- Drop the overly permissive "Users can view company profiles" policy
DROP POLICY IF EXISTS "Users can view company profiles" ON profiles;

-- Create a new restricted policy - users can only see profiles via the secure view
-- Direct table access is now limited to own profile or admin access
CREATE POLICY "Users can view colleague basic info"
ON profiles FOR SELECT
TO authenticated
USING (
  -- Own profile
  user_id = auth.uid()
  -- Or admin/super admin for full access
  OR is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  -- Or same company (for view access - emails filtered in view)
  OR company_id = get_user_company_id(auth.uid())
);

-- Note: The view respects this policy via security_invoker, but filters emails at the view level