CREATE OR REPLACE FUNCTION public.bulk_change_stock_owner(
  _item_ids uuid[],
  _from_company uuid,
  _to_company uuid,
  _location_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(moved_rows integer, merged_rows integer, total_quantity numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moved integer := 0;
  v_merged integer := 0;
  v_total numeric := 0;
  r record;
  v_target_id uuid;
BEGIN
  IF _from_company IS NULL OR _to_company IS NULL THEN
    RAISE EXCEPTION 'Source and target company are required';
  END IF;
  IF _from_company = _to_company THEN
    RAISE EXCEPTION 'Source and target company must differ';
  END IF;
  IF _item_ids IS NULL OR array_length(_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No items selected';
  END IF;

  -- Authorization: caller must be admin/super_admin AND have access to both companies
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Only admins can change stock ownership';
  END IF;
  IF NOT (public.can_access_company(_from_company) AND public.can_access_company(_to_company)) THEN
    RAISE EXCEPTION 'You do not have access to both companies';
  END IF;

  FOR r IN
    SELECT a.*
    FROM public.warehouse_bin_allocations a
    WHERE a.warehouse_item_id = ANY (_item_ids)
      AND a.company_id = _from_company
      AND a.allocated_quantity > 0
      AND (_location_ids IS NULL OR a.location_id = ANY (_location_ids))
    FOR UPDATE
  LOOP
    -- Look for an existing target-company row for the same (item, bin, location)
    SELECT t.id INTO v_target_id
    FROM public.warehouse_bin_allocations t
    WHERE t.warehouse_item_id = r.warehouse_item_id
      AND t.bin_id = r.bin_id
      AND t.company_id = _to_company
      AND t.location_id IS NOT DISTINCT FROM r.location_id
    LIMIT 1
    FOR UPDATE;

    IF v_target_id IS NOT NULL THEN
      UPDATE public.warehouse_bin_allocations
      SET allocated_quantity = allocated_quantity + r.allocated_quantity,
          reserved_quantity = reserved_quantity + r.reserved_quantity,
          updated_at = now()
      WHERE id = v_target_id;

      DELETE FROM public.warehouse_bin_allocations WHERE id = r.id;
      v_merged := v_merged + 1;
    ELSE
      UPDATE public.warehouse_bin_allocations
      SET company_id = _to_company,
          updated_at = now()
      WHERE id = r.id;
      v_moved := v_moved + 1;
    END IF;

    v_total := v_total + r.allocated_quantity;
  END LOOP;

  moved_rows := v_moved;
  merged_rows := v_merged;
  total_quantity := v_total;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_change_stock_owner(uuid[], uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_change_stock_owner(uuid[], uuid, uuid, uuid[]) TO authenticated;