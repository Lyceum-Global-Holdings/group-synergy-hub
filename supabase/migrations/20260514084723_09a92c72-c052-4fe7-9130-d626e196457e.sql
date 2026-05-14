CREATE OR REPLACE FUNCTION public.generate_batch_number(
  _company_id uuid,
  _warehouse_item_id uuid
)
RETURNS text
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
  v_max_total_len constant int := 20; -- GS1 AI(10) limit
  v_seq_width constant int := 4;
BEGIN
  IF _company_id IS NULL OR _warehouse_item_id IS NULL THEN
    RAISE EXCEPTION 'company_id and warehouse_item_id are required';
  END IF;

  SELECT item_code INTO v_item_code
  FROM warehouse_items
  WHERE id = _warehouse_item_id
    AND company_id = _company_id;

  IF v_item_code IS NULL THEN
    v_item_code := 'ITEM';
  END IF;

  -- Strip non-alphanumerics, uppercase
  v_clean_code := regexp_replace(upper(v_item_code), '[^A-Z0-9]', '', 'g');
  IF length(v_clean_code) = 0 THEN
    v_clean_code := 'ITEM';
  END IF;

  -- YY + Julian day (DDD) -> 5 chars, sortable
  v_date_part := to_char(now() AT TIME ZONE 'UTC', 'YYDDD');

  -- Total budget: 20 - len('LOT-') - len('-YYDDD-') - seq_width = 20 - 4 - 7 - 4 = 5
  -- We allow up to 8 chars of item code, then 3-char base36 hash if still over.
  IF length(v_clean_code) > 5 THEN
    v_clean_code := substr(v_clean_code, 1, 5);
  END IF;

  v_prefix := 'LOT-' || v_clean_code || '-' || v_date_part || '-';

  -- Advisory lock per (company, item, day) to serialize sequence allocation
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

  -- Defensive: ensure not already taken (other prefix collisions)
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

GRANT EXECUTE ON FUNCTION public.generate_batch_number(uuid, uuid) TO authenticated;