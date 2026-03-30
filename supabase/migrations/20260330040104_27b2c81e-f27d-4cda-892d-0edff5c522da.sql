
-- Drop existing restrictive RLS policies on warehouse_bin_allocations
DROP POLICY IF EXISTS "Users can view bin allocations" ON public.warehouse_bin_allocations;
DROP POLICY IF EXISTS "Users can create bin allocations" ON public.warehouse_bin_allocations;
DROP POLICY IF EXISTS "Authenticated users can update bin allocations" ON public.warehouse_bin_allocations;
DROP POLICY IF EXISTS "Admins can delete bin allocations" ON public.warehouse_bin_allocations;

-- SELECT: company-aware visibility (matches warehouse module pattern)
CREATE POLICY "Company users can view bin allocations"
  ON public.warehouse_bin_allocations
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR can_access_company(company_id)
  );

-- INSERT: company-aware + created_by must match auth.uid()
CREATE POLICY "Company users can create bin allocations"
  ON public.warehouse_bin_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      company_id IS NULL
      OR can_access_company(company_id)
    )
  );

-- UPDATE: company-aware access
CREATE POLICY "Company users can update bin allocations"
  ON public.warehouse_bin_allocations
  FOR UPDATE
  TO authenticated
  USING (
    company_id IS NULL
    OR can_access_company(company_id)
  )
  WITH CHECK (
    company_id IS NULL
    OR can_access_company(company_id)
  );

-- DELETE: admin only, company-scoped
CREATE POLICY "Admins can delete bin allocations"
  ON public.warehouse_bin_allocations
  FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid())
    AND (
      company_id IS NULL
      OR can_access_company(company_id)
    )
  );
