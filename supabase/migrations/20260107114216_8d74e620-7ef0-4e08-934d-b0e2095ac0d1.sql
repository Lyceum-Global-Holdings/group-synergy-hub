-- Create user_location_assignments table to map users to their assigned warehouse locations
CREATE TABLE public.user_location_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES warehouse_locations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  UNIQUE(user_id, location_id)
);

-- Enable RLS
ALTER TABLE public.user_location_assignments ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is assigned to a location
CREATE OR REPLACE FUNCTION public.user_has_location_access(_user_id UUID, _location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_location_assignments
    WHERE user_id = _user_id
      AND location_id = _location_id
  )
$$;

-- Create security definer function to get user's assigned location IDs
CREATE OR REPLACE FUNCTION public.get_user_location_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location_id
  FROM public.user_location_assignments
  WHERE user_id = _user_id
$$;

-- RLS Policies for user_location_assignments
CREATE POLICY "Users can view their own location assignments"
  ON public.user_location_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all location assignments"
  ON public.user_location_assignments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can insert location assignments"
  ON public.user_location_assignments FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update location assignments"
  ON public.user_location_assignments FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete location assignments"
  ON public.user_location_assignments FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Drop existing SELECT policy on warehouse_tools
DROP POLICY IF EXISTS "Users can view warehouse tools" ON public.warehouse_tools;

-- Create new location-based SELECT policy for warehouse_tools
CREATE POLICY "Users can view tools in their assigned locations"
  ON public.warehouse_tools FOR SELECT
  USING (
    -- Allow if user is assigned to the tool's location
    location_id IN (SELECT public.get_user_location_ids(auth.uid()))
    OR
    -- Allow if tool has no location assigned (global tools)
    location_id IS NULL
    OR
    -- Allow super admins and admins to see all tools
    public.has_role(auth.uid(), 'super_admin')
    OR
    public.has_role(auth.uid(), 'admin')
  );