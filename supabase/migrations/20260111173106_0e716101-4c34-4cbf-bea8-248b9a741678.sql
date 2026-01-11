-- Drop the existing SELECT policy that allows NULL company_id access
DROP POLICY IF EXISTS "Users can view supplier contacts for their company" ON public.supplier_contacts;

-- Create a stricter policy that only allows access to suppliers within user's company or admin access
CREATE POLICY "Users can view supplier contacts for their company" 
ON public.supplier_contacts 
FOR SELECT 
USING (
  supplier_id IN (
    SELECT suppliers.id
    FROM suppliers
    WHERE (
      suppliers.company_id = ANY (get_user_company_ids(auth.uid()))
      OR is_admin(auth.uid())
    )
  )
);