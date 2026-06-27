-- Scope GRNs to the location they were created at. A GRN is stamped with the
-- selected (root) location on creation; the list is then filtered to the
-- current location (same pattern as material_issue_notes.location_id). This is
-- a client-side filter; company isolation remains the RLS boundary.

ALTER TABLE public.goods_receipt_notes
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.warehouse_locations(id);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_notes_company_location
  ON public.goods_receipt_notes (company_id, location_id);

-- Backfill existing GRNs from where stock was actually received: the location
-- on their goods-receipt stock_transactions, normalised to the root location
-- (the top-bar selector only offers root locations). GRNs with no receiving
-- transactions (draft/rejected) stay NULL → visible only under "All locations".
UPDATE public.goods_receipt_notes g
   SET location_id = public.get_root_location_id(st.location_id)
  FROM (
    SELECT DISTINCT ON (reference_id) reference_id, location_id
      FROM public.stock_transactions
     WHERE reference_type = 'grn' AND location_id IS NOT NULL
     ORDER BY reference_id, created_at
  ) st
 WHERE st.reference_id = g.id
   AND g.location_id IS NULL;
