
CREATE OR REPLACE FUNCTION public.ensure_warehouse_item_for_company(
  p_company_id uuid,
  p_catalog_item_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_catalog_item_id IS NULL THEN
    RAISE EXCEPTION 'company_id and catalog_item_id are required';
  END IF;

  SELECT id INTO v_id
  FROM warehouse_items
  WHERE company_id = p_company_id
    AND catalog_item_id = p_catalog_item_id
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_id := public.upsert_warehouse_inventory(
    p_company_id      => p_company_id,
    p_catalog_item_id => p_catalog_item_id,
    p_location_id     => NULL,
    p_base_uom        => NULL,
    p_secondary_uom   => NULL,
    p_track_secondary => false,
    p_reorder_level   => NULL,
    p_min_stock_level => NULL,
    p_max_stock_level => NULL,
    p_unit_cost       => NULL,
    p_selling_price   => NULL,
    p_status          => 'active',
    p_notes           => NULL
  );
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_warehouse_item_for_company(uuid, uuid) TO authenticated;

-- Hardened batch number generator: fall back to catalog item_code if no per-company row exists yet.
CREATE OR REPLACE FUNCTION public.generate_batch_number(
  _company_id uuid,
  _warehouse_item_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_code text;
  v_clean_code text;
  v_date_part text;
  v_prefix text;
  v_max_seq int := 0;
  v_next_seq int;
  v_candidate text;
  v_seq_width constant int := 4;
BEGIN
  IF _company_id IS NULL OR _warehouse_item_id IS NULL THEN
    RAISE EXCEPTION 'company_id and warehouse_item_id are required';
  END IF;

  -- Try per-company inventory row first
  SELECT item_code INTO v_item_code
  FROM warehouse_items_full
  WHERE id = _warehouse_item_id
    AND company_id = _company_id;

  -- Fallback: any inventory row for this id (catalog-driven)
  IF v_item_code IS NULL THEN
    SELECT item_code INTO v_item_code
    FROM warehouse_items_full
    WHERE id = _warehouse_item_id;
  END IF;

  -- Fallback: directly from catalog via catalog_item_id link
  IF v_item_code IS NULL THEN
    SELECT c.item_code INTO v_item_code
    FROM warehouse_items wi
    JOIN warehouse_item_catalog c ON c.id = wi.catalog_item_id
    WHERE wi.id = _warehouse_item_id;
  END IF;

  IF v_item_code IS NULL THEN
    v_item_code := 'ITEM';
  END IF;

  v_clean_code := regexp_replace(upper(v_item_code), '[^A-Z0-9]', '', 'g');
  IF length(v_clean_code) = 0 THEN
    v_clean_code := 'ITEM';
  END IF;

  v_date_part := to_char(now() AT TIME ZONE 'UTC', 'YYDDD');

  IF length(v_clean_code) > 5 THEN
    v_clean_code := substr(v_clean_code, 1, 5);
  END IF;

  v_prefix := 'LOT-' || v_clean_code || '-' || v_date_part || '-';

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_company_id::text || ':' || _warehouse_item_id::text || ':' || v_date_part, 0)
  );

  SELECT COALESCE(MAX( (regexp_match(batch_number, '-(\d+)$'))[1]::int ), 0)
    INTO v_max_seq
  FROM item_batches
  WHERE company_id = _company_id
    AND warehouse_item_id = _warehouse_item_id
    AND batch_number LIKE v_prefix || '%';

  v_next_seq := v_max_seq + 1;
  v_candidate := v_prefix || lpad(v_next_seq::text, v_seq_width, '0');

  WHILE EXISTS (
    SELECT 1 FROM item_batches
    WHERE company_id = _company_id
      AND warehouse_item_id = _warehouse_item_id
      AND batch_number = v_candidate
  ) LOOP
    v_next_seq := v_next_seq + 1;
    v_candidate := v_prefix || lpad(v_next_seq::text, v_seq_width, '0');
  END LOOP;

  RETURN v_candidate;
END;
$$;
