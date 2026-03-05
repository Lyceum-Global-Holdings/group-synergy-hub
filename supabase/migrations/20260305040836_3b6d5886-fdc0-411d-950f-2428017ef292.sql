
-- Create user_location_permissions table
CREATE TABLE public.user_location_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, location_id, permission_type)
);

-- Add view_all_locations flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS view_all_locations BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.user_location_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_location_permissions FORCE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view location permissions"
  ON public.user_location_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage location permissions"
  ON public.user_location_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.app_role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.app_role IN ('admin', 'super_admin')
    )
  );
