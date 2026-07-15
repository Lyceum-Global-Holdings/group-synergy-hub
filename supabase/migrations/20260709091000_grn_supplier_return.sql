-- Supplier return for GRN-rejected lines (ISO 9001 §8.7 disposition: "return to supplier").
--
-- Rejected GRN quantities are segregated as quarantine stock at approval; this
-- turns them into a draft supplier Material Return Note so the goods can be sent
-- back with line-level traceability to the originating GRN line.

-- 1. Material returns can now reference a GRN.
ALTER TABLE public.material_return_notes
  DROP CONSTRAINT IF EXISTS material_return_notes_reference_type_check;
ALTER TABLE public.material_return_notes
  ADD CONSTRAINT material_return_notes_reference_type_check
  CHECK (reference_type IS NULL
      OR reference_type IN ('material_issue', 'purchase_order', 'grn', 'other'));

-- 2. Line-level traceability back to the GRN line that was rejected.
ALTER TABLE public.material_return_items
  ADD COLUMN IF NOT EXISTS grn_item_id uuid REFERENCES public.grn_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_material_return_items_grn_item
  ON public.material_return_items (grn_item_id);

-- 3. Build a draft supplier return from a GRN's rejected lines.
CREATE OR REPLACE FUNCTION public.create_supplier_return_from_grn(p_grn_id uuid)
RETURNS public.material_return_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user       uuid := auth.uid();
  v_grn        record;
  v_mrn_number text;
  v_note       public.material_return_notes;
  v_total      numeric := 0;
  v_reason     text;
  v_existing   uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, grn_number, company_id, location_id, supplier_id, supplier_name, status
    INTO v_grn
  FROM public.goods_receipt_notes WHERE id = p_grn_id FOR UPDATE;

  IF v_grn.id IS NULL THEN
    RAISE EXCEPTION 'GRN % not found', p_grn_id;
  END IF;
  IF NOT public.can_access_company(v_grn.company_id) THEN
    RAISE EXCEPTION 'Not authorised for this GRN';
  END IF;
  IF v_grn.status NOT IN ('approved', 'completed') THEN
    RAISE EXCEPTION 'GRN must be approved before returning rejected goods (current: %)', v_grn.status;
  END IF;
  IF v_grn.location_id IS NULL THEN
    RAISE EXCEPTION 'GRN has no location; cannot raise a return';
  END IF;

  -- Idempotent: one supplier return per GRN.
  SELECT id INTO v_existing
  FROM public.material_return_notes
  WHERE reference_type = 'grn' AND reference_id = p_grn_id
    AND status <> 'cancelled'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    SELECT * INTO v_note FROM public.material_return_notes WHERE id = v_existing;
    RETURN v_note;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.grn_items
    WHERE grn_id = p_grn_id AND COALESCE(quantity_rejected, 0) > 0
  ) THEN
    RAISE EXCEPTION 'GRN % has no rejected lines to return', COALESCE(v_grn.grn_number, p_grn_id::text);
  END IF;

  SELECT COALESCE(SUM(COALESCE(gi.net_unit_price, gi.unit_price, 0) * gi.quantity_rejected), 0),
         'Rejected on GRN ' || COALESCE(v_grn.grn_number, '') || ': ' ||
           string_agg(DISTINCT COALESCE(gi.rejection_reason::text, 'unspecified'), ', ')
    INTO v_total, v_reason
  FROM public.grn_items gi
  WHERE gi.grn_id = p_grn_id AND COALESCE(gi.quantity_rejected, 0) > 0;

  SELECT public.generate_mrn_number() INTO v_mrn_number;

  INSERT INTO public.material_return_notes (
    mrn_number, return_date, returned_by, return_type, reason,
    reference_type, reference_id, status, total_value, notes,
    company_id, created_by, location_id
  ) VALUES (
    v_mrn_number, CURRENT_DATE,
    COALESCE(NULLIF(btrim(v_grn.supplier_name), ''), 'Supplier'),
    'supplier', v_reason,
    'grn', p_grn_id, 'draft', ROUND(v_total, 2),
    'Auto-generated from rejected lines on GRN ' || COALESCE(v_grn.grn_number, ''),
    v_grn.company_id, v_user, v_grn.location_id
  )
  RETURNING * INTO v_note;

  INSERT INTO public.material_return_items (
    mrn_id, item_id, grn_item_id, quantity_returned, unit_cost, total_cost, condition, notes
  )
  SELECT
    v_note.id,
    gi.warehouse_item_id,
    gi.id,
    gi.quantity_rejected,
    COALESCE(gi.net_unit_price, gi.unit_price, 0),
    ROUND(COALESCE(gi.net_unit_price, gi.unit_price, 0) * gi.quantity_rejected, 2),
    CASE gi.rejection_reason
      WHEN 'expired_or_near_expiry'      THEN 'expired'
      WHEN 'damaged_in_transit'          THEN 'damaged'
      WHEN 'quality_failure'             THEN 'damaged'
      WHEN 'packaging_non_conformance'   THEN 'damaged'
      ELSE 'good'   -- wrong_item / quantity_over / documentation etc. arrive intact
    END,
    COALESCE(gi.rejection_reason::text, 'unspecified') ||
      COALESCE(': ' || gi.rejection_notes, '')
  FROM public.grn_items gi
  WHERE gi.grn_id = p_grn_id
    AND COALESCE(gi.quantity_rejected, 0) > 0
    AND gi.warehouse_item_id IS NOT NULL;

  RETURN v_note;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_supplier_return_from_grn(uuid) TO authenticated;
