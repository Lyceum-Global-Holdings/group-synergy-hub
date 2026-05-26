
DROP FUNCTION IF EXISTS public.get_bin_scoped_stock_movements(uuid,uuid,uuid);

CREATE FUNCTION public.get_bin_scoped_stock_movements(
  p_item_id uuid, p_location_id uuid DEFAULT NULL, p_bin_id uuid DEFAULT NULL
) RETURNS TABLE(
  id uuid, created_at timestamptz, transaction_type text, reference_type text,
  reference_id uuid, reference_number text, reference_doc_type text,
  bin_id uuid, bin_code text, bin_name text,
  location_id uuid, location_code text, location_name text,
  quantity_change numeric, quantity_before numeric, quantity_after numeric,
  unit_cost numeric, total_value numeric, notes text, created_by uuid
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    st.id, st.created_at, st.transaction_type::text, st.reference_type::text,
    st.reference_id,
    CASE
      WHEN st.transaction_type = 'material_issue'  THEN min_doc.min_number
      WHEN st.transaction_type = 'material_return' THEN mrn_doc.mrn_number
      WHEN st.transaction_type = 'goods_receipt'   THEN grn_doc.grn_number
      WHEN st.transaction_type IN ('transfer_in','transfer_out') THEN tr_doc.transfer_number
      WHEN st.transaction_type IN ('project_issue','project_return') THEN proj_doc.project_code
      ELSE NULL
    END AS reference_number,
    CASE st.transaction_type
      WHEN 'material_issue'  THEN 'Material Issue Note'
      WHEN 'material_return' THEN 'Material Return Note'
      WHEN 'goods_receipt'   THEN 'Goods Receipt Note'
      WHEN 'transfer_in'     THEN 'Stock Transfer'
      WHEN 'transfer_out'    THEN 'Stock Transfer'
      WHEN 'project_issue'   THEN 'Project Issue'
      WHEN 'project_return'  THEN 'Project Return'
      WHEN 'opening_stock'   THEN 'Opening Stock'
      WHEN 'adjustment'      THEN 'Stock Adjustment'
      ELSE NULL
    END AS reference_doc_type,
    st.bin_id, wb.bin_code, wb.name AS bin_name,
    COALESCE(wb.location_id, st.location_id) AS location_id,
    wl.location_code, wl.name AS location_name,
    st.quantity_change, st.quantity_before, st.quantity_after,
    st.unit_cost, st.total_value, st.notes, st.created_by
  FROM public.stock_transactions st
  LEFT JOIN public.warehouse_bins wb ON wb.id = st.bin_id
  LEFT JOIN public.warehouse_locations wl ON wl.id = COALESCE(wb.location_id, st.location_id)
  LEFT JOIN public.material_issue_notes  min_doc  ON st.transaction_type = 'material_issue'  AND min_doc.id  = st.reference_id
  LEFT JOIN public.material_return_notes mrn_doc  ON st.transaction_type = 'material_return' AND mrn_doc.id  = st.reference_id
  LEFT JOIN public.goods_receipt_notes   grn_doc  ON st.transaction_type = 'goods_receipt'   AND grn_doc.id  = st.reference_id
  LEFT JOIN public.stock_transfer_requests tr_doc ON st.transaction_type IN ('transfer_in','transfer_out') AND tr_doc.id = st.reference_id
  LEFT JOIN public.construction_projects proj_doc ON st.transaction_type IN ('project_issue','project_return') AND proj_doc.id = st.reference_id
  WHERE st.item_id = p_item_id
    AND (
      (p_bin_id IS NOT NULL AND st.bin_id = p_bin_id)
      OR (p_bin_id IS NULL AND (
        p_location_id IS NULL
        OR wb.location_id = p_location_id
        OR (st.bin_id IS NULL AND st.location_id = p_location_id)
      ))
    )
  ORDER BY st.created_at DESC, st.id DESC;
$$;
