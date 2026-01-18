-- Backfill batches for previously approved GRNs that are missing batches
INSERT INTO public.item_batches (
  warehouse_item_id,
  batch_number,
  manufacturing_date,
  expiry_date,
  quantity_received,
  quantity_remaining,
  unit_cost,
  grn_item_id,
  company_id,
  status
)
SELECT 
  gi.warehouse_item_id,
  COALESCE(gi.batch_number, 'BATCH-' || to_char(grn.created_at, 'YYYYMMDD-HH24MISS') || '-' || SUBSTRING(gi.id::text, 1, 8)),
  gi.manufacturing_date,
  gi.expiry_date,
  gi.quantity_received,
  gi.quantity_received,
  gi.unit_price,
  gi.id,
  grn.company_id,
  'active'
FROM public.grn_items gi
JOIN public.goods_receipt_notes grn ON grn.id = gi.grn_id
JOIN public.warehouse_items wi ON wi.id = gi.warehouse_item_id
LEFT JOIN public.item_batches ib ON ib.grn_item_id = gi.id
WHERE grn.status IN ('approved', 'completed')
  AND gi.quality_status = 'good'
  AND gi.quantity_received > 0
  AND wi.is_batch_tracked = true
  AND ib.id IS NULL
ON CONFLICT (warehouse_item_id, batch_number, company_id) 
DO UPDATE SET
  quantity_received = item_batches.quantity_received + EXCLUDED.quantity_received,
  quantity_remaining = item_batches.quantity_remaining + EXCLUDED.quantity_received,
  updated_at = NOW();