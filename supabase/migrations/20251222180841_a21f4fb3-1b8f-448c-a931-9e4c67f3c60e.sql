-- Backfill missing stock transactions for completed material returns
INSERT INTO stock_transactions (
  item_id,
  transaction_type,
  reference_type,
  reference_id,
  quantity_change,
  quantity_before,
  quantity_after,
  notes,
  created_at
)
SELECT 
  mri.item_id,
  'material_return'::stock_transaction_type,
  'mrn'::stock_reference_type,
  mrn.id,
  mri.quantity_returned,
  GREATEST(0, wi.current_stock - mri.quantity_returned),
  wi.current_stock,
  'Material Return via MRN: ' || mrn.mrn_number || ' (Retroactive backfill)',
  COALESCE(mrn.return_date::timestamp with time zone, mrn.updated_at)
FROM material_return_notes mrn
JOIN material_return_items mri ON mri.mrn_id = mrn.id
JOIN warehouse_items wi ON wi.id = mri.item_id
WHERE mrn.status = 'returned'
AND NOT EXISTS (
  SELECT 1 FROM stock_transactions st 
  WHERE st.reference_id = mrn.id 
  AND st.item_id = mri.item_id 
  AND st.transaction_type = 'material_return'
);