-- Add operations array column to role_modules with default view permission
ALTER TABLE role_modules 
ADD COLUMN IF NOT EXISTS operations text[] DEFAULT ARRAY['view'];

-- Add operations array column to user_modules with default view permission
ALTER TABLE user_modules 
ADD COLUMN IF NOT EXISTS operations text[] DEFAULT ARRAY['view'];

-- Create helper function to check operation access
CREATE OR REPLACE FUNCTION has_operation_access(
  _user_id uuid, 
  _module_key text, 
  _operation text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admins always have all operations
    is_admin(_user_id)
    OR
    -- Check user-specific grants first
    EXISTS (
      SELECT 1 FROM user_modules um
      WHERE um.user_id = _user_id 
      AND um.module_key = _module_key 
      AND um.access_type = 'grant'
      AND _operation = ANY(um.operations)
    )
    OR
    -- Check role-based operations (if no user-specific grants exist for this module)
    (
      NOT EXISTS (
        SELECT 1 FROM user_modules um
        WHERE um.user_id = _user_id 
        AND um.module_key = _module_key
        AND um.access_type = 'grant'
      )
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_modules rm ON ur.role_id = rm.role_id
        WHERE ur.user_id = _user_id 
        AND rm.module_key = _module_key
        AND _operation = ANY(rm.operations)
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_modules um
        WHERE um.user_id = _user_id 
        AND um.module_key = _module_key 
        AND um.access_type = 'deny'
      )
    );
$$;

-- Update existing role_modules to have full operations for admins
UPDATE role_modules 
SET operations = ARRAY['view', 'add', 'edit', 'delete', 'download']
WHERE role_id IN (
  SELECT id FROM roles WHERE app_role IN ('admin', 'super_admin')
);

-- Update existing role_modules to have manager-level operations
UPDATE role_modules 
SET operations = ARRAY['view', 'add', 'edit', 'download']
WHERE role_id IN (
  SELECT id FROM roles WHERE app_role = 'manager'
) AND operations = ARRAY['view'];

-- Add comment for documentation
COMMENT ON FUNCTION has_operation_access IS 'Check if a user has a specific operation permission for a module. Operations: view, add, edit, delete, download';