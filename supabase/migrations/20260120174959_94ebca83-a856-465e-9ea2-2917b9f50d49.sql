-- Security Hardening Migration - Phase 3
-- Fix remaining 3 construction_inventory_master policies

-- Drop the old permissive policies
DROP POLICY IF EXISTS "Authenticated users can delete inventory master" ON public.construction_inventory_master;
DROP POLICY IF EXISTS "Authenticated users can insert inventory master" ON public.construction_inventory_master;
DROP POLICY IF EXISTS "Authenticated users can update inventory master" ON public.construction_inventory_master;

-- Drop any existing replacement policies to avoid duplicates
DROP POLICY IF EXISTS "Construction users can insert inventory master" ON public.construction_inventory_master;
DROP POLICY IF EXISTS "Construction users can update inventory master" ON public.construction_inventory_master;
DROP POLICY IF EXISTS "Admins can delete inventory master" ON public.construction_inventory_master;

-- Create proper company-scoped and role-based policies
CREATE POLICY "Construction users can insert inventory master"
ON public.construction_inventory_master FOR INSERT
WITH CHECK (can_access_company(company_id) AND has_construction_access(auth.uid()));

CREATE POLICY "Construction users can update inventory master"
ON public.construction_inventory_master FOR UPDATE
USING (can_access_company(company_id) AND (created_by = auth.uid() OR is_admin(auth.uid())));

CREATE POLICY "Admins can delete inventory master"
ON public.construction_inventory_master FOR DELETE
USING (can_access_company(company_id) AND is_admin(auth.uid()));