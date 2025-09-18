-- Grant admin access to sudarakappl@gmail.com
DO $$
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
    VALUES ('Admin', 'System Administrator with full access', 'admin')
    RETURNING id INTO admin_role_id;
  END IF;
  
  -- Assign admin role to user
  INSERT INTO user_roles (user_id, role_id)
  VALUES ('fa515d9a-d9f4-4ac4-8003-95e0d6858378', admin_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
END $$;