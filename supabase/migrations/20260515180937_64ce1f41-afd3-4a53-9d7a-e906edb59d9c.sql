CREATE OR REPLACE FUNCTION public.create_partial_pieces_bulk(
  p_company_id uuid,
  p_parent_item_id uuid,
  p_location_id uuid,
  p_bin_id uuid,
  p_shared jsonb,
  p_rows jsonb
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_payload jsonb;
  v_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_parent_item_id IS NULL OR p_location_id IS NULL THEN
    RAISE EXCEPTION 'company_id, parent_item_id and location_id are required';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'p_rows must be a non-empty JSON array';
  END IF;

  IF jsonb_array_length(p_rows) > 200 THEN
    RAISE EXCEPTION 'Cannot create more than 200 partial pieces per batch (got %)', jsonb_array_length(p_rows);
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
  LOOP
    IF (v_row->>'size_value') IS NULL OR (v_row->>'size_value')::numeric <= 0 THEN
      RAISE EXCEPTION 'Each row must have size_value > 0';
    END IF;

    v_payload := COALESCE(p_shared, '{}'::jsonb)
      || jsonb_build_object(
           'company_id', p_company_id,
           'parent_item_id', p_parent_item_id,
           'location_id', p_location_id,
           'bin_id', p_bin_id,
           'size_value', (v_row->>'size_value')::numeric
         );

    IF v_row ? 'piece_code' AND NULLIF(v_row->>'piece_code','') IS NOT NULL THEN
      v_payload := v_payload || jsonb_build_object('piece_code', v_row->>'piece_code');
    END IF;

    IF v_row ? 'label' AND NULLIF(v_row->>'label','') IS NOT NULL THEN
      v_payload := v_payload || jsonb_build_object('label', v_row->>'label');
    END IF;

    v_id := public.create_partial_piece(v_payload);
    RETURN NEXT v_id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_partial_pieces_bulk(uuid, uuid, uuid, uuid, jsonb, jsonb) TO authenticated;
