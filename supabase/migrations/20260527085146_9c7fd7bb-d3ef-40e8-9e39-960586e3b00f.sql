DROP POLICY IF EXISTS "Users can view their own requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Company users can view asset requests" ON public.asset_requests;

CREATE POLICY "Company users can view asset requests"
ON public.asset_requests
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_admin(auth.uid())
  OR auth.uid() = created_by
  OR auth.uid() = requested_by
  OR public.can_access_company(company_id)
);

DROP POLICY IF EXISTS "Users can create asset requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Company users can create asset requests" ON public.asset_requests;

CREATE POLICY "Company users can create asset requests"
ON public.asset_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND company_id IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR public.can_access_company(company_id)
  )
);