-- Insert sample users into auth.users
-- Note: In production, users should be created through the signup flow
-- These are for development/testing purposes only

-- Sample Admin User
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  'admin@company.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Admin User", "role": "admin"}',
  false,
  'authenticated'
);

-- Sample Manager User
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  'manager@company.com',
  crypt('manager123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Manager User", "role": "manager"}',
  false,
  'authenticated'
);

-- Sample Regular User
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  'user@company.com',
  crypt('user123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Regular User", "role": "user"}',
  false,
  'authenticated'
);

-- The profiles will be automatically created by our trigger