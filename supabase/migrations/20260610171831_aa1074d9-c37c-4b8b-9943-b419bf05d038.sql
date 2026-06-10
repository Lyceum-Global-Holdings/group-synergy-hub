DROP POLICY IF EXISTS "Users can view GRN items they have access to" ON public.grn_items;

CREATE POLICY "Users can view GRN items in their company"
  ON public.grn_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goods_receipt_notes grn
      WHERE grn.id = grn_items.grn_id
        AND public.can_access_company(grn.company_id)
    )
  );