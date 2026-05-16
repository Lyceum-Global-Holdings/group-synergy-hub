
-- 1. Audit table
CREATE TABLE IF NOT EXISTS public.warehouse_bin_relocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id uuid NOT NULL REFERENCES public.warehouse_bins(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  from_location_id uuid,
  to_location_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('with_stock','empty_only')),
  reason text,
  item_count int NOT NULL DEFAULT 0,
  total_quantity numeric NOT NULL DEFAULT 0,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bin_reloc_bin ON public.warehouse_bin_relocations(bin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bin_reloc_company ON public.warehouse_bin_relocations(company_id, created_at DESC);

ALTER TABLE public.warehouse_bin_relocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bin_reloc_select" ON public.warehouse_bin_relocations;
CREATE POLICY "bin_reloc_select" ON public.warehouse_bin_relocations
  FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));

-- 2. Relocation RPC
CREATE OR REPLACE FUNCTION public.relocate_warehouse_bin(
  _bin_id uuid,
  _new_location_id uuid,
  _mode text,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bin           public.warehouse_bins%ROWTYPE;
  v_old_loc       public.warehouse_locations%ROWTYPE;
  v_new_loc       public.warehouse_locations%ROWTYPE;
  v_root_id       uuid;
  v_item_count    int := 0;
  v_total_qty     numeric := 0;
  v_user          uuid := auth.uid();
  v_old_name      text;
  v_new_name      text;
  rec             RECORD;
BEGIN
  IF _mode NOT IN ('with_stock','empty_only') THEN
    RAISE EXCEPTION 'Invalid mode %', _mode;
  END IF;

  SELECT * INTO v_bin FROM public.warehouse_bins WHERE id = _bin_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bin % not found', _bin_id; END IF;

  IF NOT public.can_access_company(v_bin.company_id) THEN
    RAISE EXCEPTION 'Not authorised for this bin''s company';
  END IF;

  SELECT * INTO v_new_loc FROM public.warehouse_locations WHERE id = _new_location_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destination location % not found', _new_location_id; END IF;

  IF v_new_loc.company_id IS DISTINCT FROM v_bin.company_id THEN
    RAISE EXCEPTION 'Destination belongs to a different company. Use Stock Transfer for cross-company moves.';
  END IF;

  IF v_bin.location_id = _new_location_id THEN
    RAISE EXCEPTION 'Bin is already at the selected location';
  END IF;

  -- Depth check: parent of destination (if any) cannot itself have a parent
  IF v_new_loc.parent_id IS NOT NULL THEN
    PERFORM 1 FROM public.warehouse_locations
      WHERE id = v_new_loc.parent_id AND parent_id IS NOT NULL;
    IF FOUND THEN RAISE EXCEPTION 'Destination would be nested more than 2 levels deep'; END IF;
  END IF;

  IF v_bin.location_id IS NOT NULL THEN
    SELECT * INTO v_old_loc FROM public.warehouse_locations WHERE id = v_bin.location_id;
    v_old_name := COALESCE(v_old_loc.name, 'Unknown');
  ELSE
    v_old_name := 'Unassigned';
  END IF;
  v_new_name := v_new_loc.name;

  -- Compute totals from current allocations
  SELECT COUNT(*)::int, COALESCE(SUM(allocated_quantity),0)::numeric
    INTO v_item_count, v_total_qty
  FROM public.warehouse_bin_allocations
  WHERE bin_id = _bin_id;

  IF _mode = 'empty_only' AND v_total_qty > 0 THEN
    RAISE EXCEPTION 'Bin still holds % units across % allocations. Issue or transfer stock out first, or use "Move with stock".',
      v_total_qty, v_item_count;
  END IF;

  -- Resolve new root warehouse
  v_root_id := COALESCE(v_new_loc.parent_id, v_new_loc.id);

  -- Update bin pointer
  UPDATE public.warehouse_bins
    SET location_id = _new_location_id,
        root_location_id = v_root_id,
        updated_at = now()
    WHERE id = _bin_id;

  IF _mode = 'with_stock' AND v_total_qty > 0 THEN
    -- Move all allocations to the new physical node
    UPDATE public.warehouse_bin_allocations
      SET location_id = _new_location_id,
          updated_at = now()
      WHERE bin_id = _bin_id;

    -- Trace each affected item in the stock ledger (qty unchanged)
    FOR rec IN
      SELECT warehouse_item_id, COALESCE(SUM(allocated_quantity),0)::numeric AS qty
      FROM public.warehouse_bin_allocations
      WHERE bin_id = _bin_id
      GROUP BY warehouse_item_id
    LOOP
      INSERT INTO public.stock_transactions(
        item_id, transaction_type, reference_type, reference_id,
        quantity_change, location_id, bin_id, company_id,
        created_by, adjustment_reason, notes
      ) VALUES (
        rec.warehouse_item_id, 'adjustment', 'adjustment', _bin_id,
        0, _new_location_id, _bin_id, v_bin.company_id,
        v_user, 'bin_relocation',
        format('Bin %s moved from %s to %s%s',
               v_bin.bin_code, v_old_name, v_new_name,
               CASE WHEN _reason IS NOT NULL AND length(trim(_reason))>0
                    THEN ' — ' || _reason ELSE '' END)
      );
    END LOOP;
  END IF;

  INSERT INTO public.warehouse_bin_relocations(
    bin_id, company_id, from_location_id, to_location_id,
    mode, reason, item_count, total_quantity, performed_by
  ) VALUES (
    _bin_id, v_bin.company_id, v_bin.location_id, _new_location_id,
    _mode, _reason, v_item_count, v_total_qty, v_user
  );

  RETURN jsonb_build_object(
    'bin_id', _bin_id,
    'from_location_id', v_bin.location_id,
    'to_location_id', _new_location_id,
    'mode', _mode,
    'item_count', v_item_count,
    'total_quantity', v_total_qty
  );
END $$;

REVOKE ALL ON FUNCTION public.relocate_warehouse_bin(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relocate_warehouse_bin(uuid, uuid, text, text) TO authenticated;
