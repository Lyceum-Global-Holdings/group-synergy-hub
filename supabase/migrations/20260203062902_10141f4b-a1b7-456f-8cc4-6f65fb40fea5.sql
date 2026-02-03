-- Add missing SELECT policy for warehouse_items
-- This fixes the issue where Item Master shows no items for company users

CREATE POLICY "Users can view company warehouse items"
ON public.warehouse_items
FOR SELECT
TO authenticated
USING (
  can_access_company(company_id)
  OR company_id IS NULL
);

-- Add comment documenting the security model
COMMENT ON TABLE public.warehouse_items IS 
'Warehouse inventory items with company-scoped RLS. SELECT requires company membership via can_access_company().';