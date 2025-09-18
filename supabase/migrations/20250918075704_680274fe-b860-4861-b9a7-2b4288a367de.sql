-- Create app_role enum for role types
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'manager', 'user');

-- Create permissions table
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  department TEXT,
  app_role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles junction table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Create role_permissions junction table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Enable RLS on all tables
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _app_role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND r.app_role = _app_role
  );
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'super_admin');
$$;

-- RLS Policies for permissions
CREATE POLICY "Authenticated users can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can modify permissions" ON public.permissions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- RLS Policies for roles
CREATE POLICY "Authenticated users can view roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can modify roles" ON public.roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view all user roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can modify user roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- RLS Policies for role_permissions
CREATE POLICY "Authenticated users can view role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can modify role permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Update profiles table to include departments
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;

-- Insert default permissions
INSERT INTO public.permissions (name, description, category) VALUES
  ('user.view', 'View user profiles', 'users'),
  ('user.create', 'Create new users', 'users'),
  ('user.update', 'Update user information', 'users'),
  ('user.delete', 'Delete users', 'users'),
  ('role.view', 'View roles and permissions', 'roles'),
  ('role.create', 'Create new roles', 'roles'),
  ('role.update', 'Update roles and permissions', 'roles'),
  ('role.delete', 'Delete roles', 'roles'),
  ('company.view', 'View company information', 'companies'),
  ('company.create', 'Create companies', 'companies'),
  ('company.update', 'Update company information', 'companies'),
  ('company.delete', 'Delete companies', 'companies'),
  ('module.allocate', 'Allocate modules to companies', 'modules'),
  ('dashboard.view', 'Access dashboard', 'dashboard'),
  ('reports.view', 'View reports', 'reports'),
  ('settings.manage', 'Manage system settings', 'settings');

-- Insert default roles
INSERT INTO public.roles (name, description, department, app_role) VALUES
  ('Super Administrator', 'Full system access with all permissions', 'IT', 'super_admin'),
  ('Administrator', 'System administration with most permissions', 'IT', 'admin'),
  ('HR Manager', 'Human resources management', 'Human Resources', 'manager'),
  ('IT Manager', 'Information technology management', 'IT', 'manager'),
  ('Finance Manager', 'Financial operations management', 'Finance', 'manager'),
  ('Regular User', 'Basic user with limited permissions', 'General', 'user');

-- Get role IDs for permission assignments
DO $$
DECLARE
  super_admin_role_id UUID;
  admin_role_id UUID;
  hr_manager_role_id UUID;
  it_manager_role_id UUID;
  finance_manager_role_id UUID;
  user_role_id UUID;
BEGIN
  SELECT id INTO super_admin_role_id FROM public.roles WHERE name = 'Super Administrator';
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'Administrator';
  SELECT id INTO hr_manager_role_id FROM public.roles WHERE name = 'HR Manager';
  SELECT id INTO it_manager_role_id FROM public.roles WHERE name = 'IT Manager';
  SELECT id INTO finance_manager_role_id FROM public.roles WHERE name = 'Finance Manager';
  SELECT id INTO user_role_id FROM public.roles WHERE name = 'Regular User';

  -- Super Admin gets all permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT super_admin_role_id, id FROM public.permissions;

  -- Admin gets most permissions (exclude some super admin only features if needed)
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM public.permissions;

  -- HR Manager permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT hr_manager_role_id, id FROM public.permissions 
  WHERE name IN ('user.view', 'user.create', 'user.update', 'role.view', 'dashboard.view', 'reports.view');

  -- IT Manager permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT it_manager_role_id, id FROM public.permissions 
  WHERE name IN ('user.view', 'user.update', 'role.view', 'company.view', 'company.update', 'module.allocate', 'dashboard.view', 'reports.view', 'settings.manage');

  -- Finance Manager permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT finance_manager_role_id, id FROM public.permissions 
  WHERE name IN ('user.view', 'company.view', 'dashboard.view', 'reports.view');

  -- Regular User permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT user_role_id, id FROM public.permissions 
  WHERE name IN ('dashboard.view');
END $$;

-- Add triggers for updated_at
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();