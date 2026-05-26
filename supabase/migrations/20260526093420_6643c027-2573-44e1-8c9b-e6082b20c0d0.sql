CREATE OR REPLACE FUNCTION public.reconcile_bin_allocations(
  p_company_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE(items_backfilled int, qty_backfilled numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item record;
  v_root_id uuid;
  v_bin_id uuid;
  v_bin_loc uuid;
  v_gap numeric;
  v_items int := 0;
  v_qty numeric := 0;
BEGIN
  FOR v_item IN
    SELECT wi.id, wi.company_id, wi.location_id, wi.current_stock,
           COALESCE((
             SELECT SUM(wba.allocated_quantity)
             FROM warehouse_bin_allocations wba
             WHERE wba.warehouse_item_id = wi.id
               AND wba.location_id = wi.location_id
           ), 0) AS alloc_in_loc
    FROM warehouse_items wi
    WHERE wi.current_stock > 0
      AND wi.location_id IS NOT NULL
      AND wi.company_id IS NOT NULL
      AND (p_company_id IS NULL OR wi.company_id = p_company_id)
      AND (p_location_id IS NULL OR wi.location_id = p_location_id)
  LOOP
    v_gap := v_item.current_stock - v_item.alloc_in_loc;
    IF v_gap <= 0 THEN CONTINUE; END IF;

    -- Resolve the root warehouse for the item's location
    WITH RECURSIVE chain AS (
      SELECT id, parent_id, 1 AS lvl FROM warehouse_locations WHERE id = v_item.location_id
      UNION ALL
      SELECT wl.id, wl.parent_id, c.lvl + 1
      FROM warehouse_locations wl JOIN chain c ON wl.id = c.parent_id
    )
    SELECT id INTO v_root_id FROM chain WHERE parent_id IS NULL ORDER BY lvl DESC LIMIT 1;
    IF v_root_id IS NULL THEN v_root_id := v_item.location_id; END IF;

    v_bin_id := NULL;

    -- 1. Existing SYS-LEGACY for this company in this root warehouse (any sub-location)
    SELECT id, location_id INTO v_bin_id, v_bin_loc
    FROM warehouse_bins
    WHERE company_id = v_item.company_id
      AND root_location_id = v_root_id
      AND lower(bin_code) = 'sys-legacy'
    LIMIT 1;

    -- 2. Otherwise reuse another company's SYS-LEGACY at root location (and mark shared)
    IF v_bin_id IS NULL THEN
      SELECT id, location_id INTO v_bin_id, v_bin_loc
      FROM warehouse_bins
      WHERE location_id = v_root_id
        AND lower(bin_code) = 'sys-legacy'
      LIMIT 1;

      IF v_bin_id IS NOT NULL THEN
        UPDATE warehouse_bins SET is_shared = true, updated_at = now()
        WHERE id = v_bin_id AND is_shared = false;
      END IF;
    END IF;

    -- 3. Create a fresh SYS-LEGACY bin at the root warehouse for this company
    IF v_bin_id IS NULL THEN
      INSERT INTO warehouse_bins
        (id, bin_code, name, status, company_id, location_id,
         root_location_id, is_shared, is_global_template,
         description, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'SYS-LEGACY', 'System Legacy Bin', 'active',
         v_item.company_id, v_root_id, v_root_id,
         false, false,
         'Auto-created to hold pre-existing on-hand stock without a bin assignment.',
         now(), now())
      RETURNING id, location_id INTO v_bin_id, v_bin_loc;
    END IF;

    INSERT INTO warehouse_bin_allocations
      (id, warehouse_item_id, bin_id, company_id, location_id,
       allocated_quantity, reserved_quantity,
       notes, created_at, updated_at)
    VALUES
      (gen_random_uuid(), v_item.id, v_bin_id,
       v_item.company_id, COALESCE(v_bin_loc, v_root_id),
       v_gap, 0,
       '[reconcile] backfilled from item master current_stock',
       now(), now())
    ON CONFLICT (warehouse_item_id, bin_id) DO UPDATE
      SET allocated_quantity = warehouse_bin_allocations.allocated_quantity + EXCLUDED.allocated_quantity,
          updated_at = now();

    v_items := v_items + 1;
    v_qty := v_qty + v_gap;
  END LOOP;

  items_backfilled := v_items;
  qty_backfilled := v_qty;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_bin_allocations(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_bin_allocations(uuid, uuid) TO authenticated, service_role;

SELECT * FROM public.reconcile_bin_allocations();