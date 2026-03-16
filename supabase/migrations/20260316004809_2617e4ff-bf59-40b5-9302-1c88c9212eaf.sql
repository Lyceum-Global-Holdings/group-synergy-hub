
DROP POLICY IF EXISTS "Users can view company warehouse items" ON public.warehouse_items;
DROP POLICY IF EXISTS "Warehouse and procurement users can view warehouse items" ON public.warehouse_items;

CREATE POLICY "Warehouse users can view all items"
ON public.warehouse_items FOR SELECT TO authenticated
USING (
  has_warehouse_access(auth.uid())
  OR has_procurement_access(auth.uid())
  OR has_finance_access(auth.uid())
  OR is_admin(auth.uid())
  OR is_super_admin(auth.uid())
);
