-- Remove the incorrectly created test users
DELETE FROM auth.users WHERE email IN ('admin@company.com', 'manager@company.com', 'user@company.com');