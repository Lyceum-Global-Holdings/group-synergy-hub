DROP POLICY IF EXISTS "Warehouse users can view all items" ON public.warehouse_items;
CREATE POLICY "Authenticated users can view warehouse items"
  ON public.warehouse_items FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized roles can view catalog" ON public.warehouse_item_catalog;
CREATE POLICY "Authenticated users can view catalog"
  ON public.warehouse_item_catalog FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);