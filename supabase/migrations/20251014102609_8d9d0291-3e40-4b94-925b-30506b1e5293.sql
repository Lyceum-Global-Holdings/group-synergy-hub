-- Drop the conflicting ALL policy
DROP POLICY IF EXISTS "Users can manage items for their sales orders" ON sales_order_items;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view sales order items" ON sales_order_items;

-- Create new SELECT policy with company-based filtering
CREATE POLICY "Users can view sales order items in their company"
ON sales_order_items FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_items.sales_order_id
    AND (
      so.company_id = ANY(get_user_company_ids(auth.uid()))
      OR is_admin(auth.uid())
    )
  )
);

-- Create INSERT policy (restrictive)
CREATE POLICY "Users can create items for their sales orders"
ON sales_order_items FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_items.sales_order_id
    AND (so.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

-- Create UPDATE policy (restrictive)
CREATE POLICY "Users can update items for their sales orders"
ON sales_order_items FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_items.sales_order_id
    AND (so.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

-- Create DELETE policy (restrictive)
CREATE POLICY "Users can delete items for their sales orders"
ON sales_order_items FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_items.sales_order_id
    AND (so.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);