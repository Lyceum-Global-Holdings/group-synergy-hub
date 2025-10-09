-- Fix grn_items RLS policy to allow INSERT operations
DO $$
BEGIN
  -- Drop the existing manage policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename = 'grn_items'
      AND policyname = 'Users can manage items for their own GRNs'
  ) THEN
    DROP POLICY "Users can manage items for their own GRNs" ON public.grn_items;
  END IF;

  -- Recreate with both USING and WITH CHECK clauses
  CREATE POLICY "Users can manage items for their own GRNs"
  ON public.grn_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM goods_receipt_notes grn
      WHERE grn.id = grn_items.grn_id
        AND (
          (grn.created_by = auth.uid() AND grn.status = 'draft')
          OR is_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goods_receipt_notes grn
      WHERE grn.id = grn_items.grn_id
        AND (
          (grn.created_by = auth.uid() AND grn.status = 'draft')
          OR is_admin(auth.uid())
        )
    )
  );
END $$;