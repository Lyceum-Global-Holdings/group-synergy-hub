
-- Replace the all-in-one policy with split rules so item creation works at
-- submission time, while edits/deletes are still locked after draft.

DROP POLICY IF EXISTS "Users can manage items for their own GRNs" ON public.grn_items;
DROP POLICY IF EXISTS "Users can update draft GRN items only" ON public.grn_items;

-- INSERT: owner can add lines while header is draft or submitted; admins always.
CREATE POLICY "GRN owners can insert items during draft or submission"
ON public.grn_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.goods_receipt_notes grn
    WHERE grn.id = grn_items.grn_id
      AND (
        public.is_admin(auth.uid())
        OR (
          grn.created_by = auth.uid()
          AND grn.status IN ('draft','submitted')
        )
      )
  )
);

-- UPDATE: only while the header is still draft (admin override).
CREATE POLICY "GRN items editable only while draft"
ON public.grn_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goods_receipt_notes grn
    WHERE grn.id = grn_items.grn_id
      AND (
        public.is_admin(auth.uid())
        OR (grn.created_by = auth.uid() AND grn.status = 'draft')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.goods_receipt_notes grn
    WHERE grn.id = grn_items.grn_id
      AND (
        public.is_admin(auth.uid())
        OR (grn.created_by = auth.uid() AND grn.status = 'draft')
      )
  )
);

-- DELETE: same window as UPDATE.
CREATE POLICY "GRN items deletable only while draft"
ON public.grn_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goods_receipt_notes grn
    WHERE grn.id = grn_items.grn_id
      AND (
        public.is_admin(auth.uid())
        OR (grn.created_by = auth.uid() AND grn.status = 'draft')
      )
  )
);
