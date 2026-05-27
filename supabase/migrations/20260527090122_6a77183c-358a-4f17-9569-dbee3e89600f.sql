CREATE POLICY "Company users can update asset requests"
ON public.asset_requests
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR is_admin(auth.uid())
  OR (auth.uid() = created_by)
  OR (auth.uid() = requested_by)
  OR can_access_company(company_id)
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR is_admin(auth.uid())
  OR (auth.uid() = created_by)
  OR (auth.uid() = requested_by)
  OR can_access_company(company_id)
);