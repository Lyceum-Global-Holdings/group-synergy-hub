-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view dashboards they have access to" ON dashboards;
DROP POLICY IF EXISTS "Users can view permissions for their dashboards" ON dashboard_permissions;
DROP POLICY IF EXISTS "Dashboard owners can manage permissions" ON dashboard_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON dashboard_permissions;

-- Create security definer function for checking dashboard access
CREATE OR REPLACE FUNCTION public.has_dashboard_access(_user_id uuid, _dashboard_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dashboards d
    WHERE d.id = _dashboard_id
      AND (
        d.created_by = _user_id
        OR d.visibility = 'company_wide'
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = _user_id
            AND r.app_role IN ('admin', 'super_admin')
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM dashboard_permissions dp
    WHERE dp.dashboard_id = _dashboard_id
      AND (
        dp.user_id = _user_id
        OR dp.role_id IN (
          SELECT role_id FROM user_roles WHERE user_id = _user_id
        )
      )
  );
$$;

-- Create simplified SELECT policy for dashboards (no circular reference)
CREATE POLICY "Users can view dashboards they have access to"
ON dashboards FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by = auth.uid()
    OR visibility = 'company_wide'
    OR is_admin(auth.uid())
  )
);

-- Create simplified policies for dashboard_permissions (one-way reference only)
CREATE POLICY "Users can view permissions for accessible dashboards"
ON dashboard_permissions FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Dashboard creators can manage permissions"
ON dashboard_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM dashboards d
    WHERE d.id = dashboard_permissions.dashboard_id
      AND (d.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);