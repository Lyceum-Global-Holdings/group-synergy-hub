-- =====================================================================
-- 1. Backfill: populate stock_transactions.company_id from warehouse_items
-- =====================================================================
UPDATE public.stock_transactions st
SET company_id = wi.company_id
FROM public.warehouse_items wi
WHERE st.item_id = wi.id
  AND st.company_id IS NULL
  AND wi.company_id IS NOT NULL;

-- =====================================================================
-- 2. Trigger: auto-fill company_id on insert/update if blank
--    (SAP / Oracle EBS pattern: transaction inherits tenant scope from
--     the master record it operates on.)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fill_stock_transaction_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.item_id IS NOT NULL THEN
    SELECT company_id
      INTO NEW.company_id
      FROM public.warehouse_items
     WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_transactions_fill_company_id ON public.stock_transactions;
CREATE TRIGGER stock_transactions_fill_company_id
BEFORE INSERT OR UPDATE OF item_id, company_id
ON public.stock_transactions
FOR EACH ROW
EXECUTE FUNCTION public.fill_stock_transaction_company_id();

-- =====================================================================
-- 3. Drop legacy (4-arg) overloads so PostgREST always resolves to the
--    notes-filter–aware (6-arg) version.
-- =====================================================================
DROP FUNCTION IF EXISTS public.report_stock_movement_ledger(
  uuid, timestamptz, timestamptz, uuid
);
DROP FUNCTION IF EXISTS public.report_cycle_count_variance(
  uuid, date, date, uuid
);
DROP FUNCTION IF EXISTS public.report_batch_traceability(
  uuid, text, text, text
);

-- =====================================================================
-- 4. Harden report_stock_movement_ledger: scope through warehouse_items
--    so a stray NULL company_id never silently drops a row.
--    (Defence in depth — the trigger + backfill above are the primary fix.)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.report_stock_movement_ledger(
  p_company_id   uuid,
  p_date_from    timestamptz DEFAULT NULL,
  p_date_to      timestamptz DEFAULT NULL,
  p_location_id  uuid        DEFAULT NULL,
  p_notes_op     text        DEFAULT 'contains',
  p_notes_terms  text[]      DEFAULT NULL
)
RETURNS TABLE(
  txn_date          timestamptz,
  item_code         text,
  item_name         text,
  transaction_type  text,
  reference_type    text,
  quantity_change   numeric,
  quantity_before   numeric,
  quantity_after    numeric,
  unit_cost         numeric,
  total_value       numeric,
  location_name     text,
  user_email        text,
  notes             text
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  v_op    text := COALESCE(NULLIF(btrim(p_notes_op), ''), 'contains');
  v_terms text[];
  v_first text;
BEGIN
  IF v_op NOT IN ('contains','equals','startsWith','endsWith','notContains') THEN
    RAISE EXCEPTION 'invalid notes operator: %', v_op
      USING ERRCODE = '22023';
  END IF;

  -- Escape LIKE wildcards in each term and drop empties
  SELECT ARRAY(
    SELECT replace(replace(replace(btrim(t), '\', '\\'), '%', '\%'), '_', '\_')
    FROM unnest(COALESCE(p_notes_terms, ARRAY[]::text[])) AS t
    WHERE btrim(t) <> ''
  ) INTO v_terms;

  IF cardinality(v_terms) > 5 THEN
    v_terms := v_terms[1:5];
  END IF;

  v_first := CASE WHEN cardinality(v_terms) >= 1 THEN v_terms[1] ELSE NULL END;

  RETURN QUERY
  SELECT
    st.created_at AS txn_date,
    wi.item_code,
    wi.name AS item_name,
    st.transaction_type::text,
    st.reference_type::text,
    st.quantity_change,
    st.quantity_before,
    st.quantity_after,
    st.unit_cost,
    st.total_value,
    wl.name AS location_name,
    p.email AS user_email,
    st.notes
  FROM public.stock_transactions st
  JOIN public.warehouse_items wi
    ON wi.id = st.item_id
  LEFT JOIN public.warehouse_locations wl
    ON wl.id = wi.location_id
  LEFT JOIN public.profiles p
    ON p.id = st.created_by
  WHERE COALESCE(st.company_id, wi.company_id) = p_company_id
    AND (p_date_from  IS NULL OR st.created_at >= p_date_from)
    AND (p_date_to    IS NULL OR st.created_at <= p_date_to)
    AND (p_location_id IS NULL OR wi.location_id = p_location_id)
    AND (
      cardinality(v_terms) = 0
      OR CASE v_op
        WHEN 'contains'    THEN (
          SELECT bool_and(st.notes ILIKE '%' || t || '%' ESCAPE '\')
          FROM unnest(v_terms) AS t
        )
        WHEN 'equals'      THEN lower(btrim(COALESCE(st.notes,''))) = lower(btrim(v_first))
        WHEN 'startsWith'  THEN st.notes ILIKE v_first || '%' ESCAPE '\'
        WHEN 'endsWith'    THEN st.notes ILIKE '%' || v_first ESCAPE '\'
        WHEN 'notContains' THEN st.notes IS NULL OR NOT (st.notes ILIKE '%' || v_first || '%' ESCAPE '\')
      END
    )
  ORDER BY st.created_at DESC
  LIMIT 50000;
END;
$function$;