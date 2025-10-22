-- Grant administration module only to admin and super_admin roles
INSERT INTO role_modules (role_id, module_key, submodules)
SELECT 
  r.id,
  'administration',
  ARRAY['company-management', 'user-role-management', 'module-allocation', 'warehouse-management']
FROM roles r
WHERE r.app_role IN ('admin', 'super_admin')
ON CONFLICT (role_id, module_key) DO NOTHING;