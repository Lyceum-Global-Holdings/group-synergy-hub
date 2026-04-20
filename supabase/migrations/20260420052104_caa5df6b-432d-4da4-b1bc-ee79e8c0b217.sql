-- Remove overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view floor room stages" ON public.floor_room_stages;

-- Tighten write policies to be company-scoped
DROP POLICY IF EXISTS "Authenticated users can create room stages" ON public.floor_room_stages;
DROP POLICY IF EXISTS "Authenticated users can update room stages" ON public.floor_room_stages;
DROP POLICY IF EXISTS "Authenticated users can delete room stages" ON public.floor_room_stages;

CREATE POLICY "Insert room stages by company"
ON public.floor_room_stages
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "Update room stages by company"
ON public.floor_room_stages
FOR UPDATE
TO authenticated
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "Delete room stages by company"
ON public.floor_room_stages
FOR DELETE
TO authenticated
USING (public.can_access_company(company_id));