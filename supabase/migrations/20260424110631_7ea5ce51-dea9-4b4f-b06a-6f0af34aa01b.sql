-- Phase 9.5 — server-side authoritative next-item-code generator.
-- Scans warehouse_item_catalog (the table that owns the UNIQUE(item_code)
-- constraint) so the result is guaranteed not to collide on insert. Tolerates
-- mixed-width historical padding (e.g. "001" alongside "0001") by parsing the
-- leading digits of each suffix.
CREATE OR REPLACE FUNCTION public.next_catalog_item_code(p_category_code text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_cat_norm text;
  v_prefix   text;
  v_max      int;
BEGIN
  IF p_category_code IS NULL OR btrim(p_category_code) = '' THEN
    RAISE EXCEPTION 'category code is required';
  END IF;

  v_cat_norm := upper(btrim(p_category_code));
  v_prefix   := 'INV-' || v_cat_norm || '-';

  SELECT COALESCE(MAX(
    CASE
      WHEN substring(item_code FROM length(v_prefix) + 1) ~ '^\d+'
      THEN (regexp_match(substring(item_code FROM length(v_prefix) + 1), '^(\d+)'))[1]::int
      ELSE 0
    END
  ), 0)
  INTO v_max
  FROM public.warehouse_item_catalog
  WHERE item_code ILIKE v_prefix || '%';

  -- 3-digit zero-pad up to 999, natural roll-over to wider widths past that.
  RETURN v_prefix || lpad((v_max + 1)::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_catalog_item_code(text) TO authenticated;