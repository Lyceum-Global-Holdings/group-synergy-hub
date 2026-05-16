CREATE OR REPLACE VIEW public.v_adjustment_summary_by_item
WITH (security_invoker = true)
AS
SELECT
  wi.id,
  c.item_code,
  c.name,
  wi.company_id,
  count(st.*) AS total_adjustments,
  sum(CASE WHEN st.quantity_change > 0 THEN st.total_value ELSE 0 END) AS value_increases,
  sum(CASE WHEN st.quantity_change < 0 THEN abs(st.total_value) ELSE 0 END) AS value_decreases,
  sum(CASE WHEN st.quantity_change > 0 THEN st.quantity_change ELSE 0 END) AS qty_increases,
  sum(CASE WHEN st.quantity_change < 0 THEN abs(st.quantity_change) ELSE 0 END) AS qty_decreases
FROM public.warehouse_items wi
JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
LEFT JOIN public.stock_transactions st
  ON st.item_id = wi.id AND st.transaction_type = 'adjustment'::stock_transaction_type
GROUP BY wi.id, c.item_code, c.name, wi.company_id;

REVOKE ALL ON public.v_adjustment_summary_by_item FROM PUBLIC, anon;
GRANT SELECT ON public.v_adjustment_summary_by_item TO authenticated;