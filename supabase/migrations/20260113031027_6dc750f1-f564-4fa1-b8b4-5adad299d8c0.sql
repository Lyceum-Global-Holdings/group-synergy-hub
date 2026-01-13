-- Migration: Add retroactive opening stock transactions for existing items

-- Create opening stock transactions for items that have stock but no opening_stock record
INSERT INTO stock_transactions (
  item_id,
  transaction_type,
  reference_type,
  quantity_change,
  quantity_before,
  quantity_after,
  notes,
  company_id,
  created_at,
  updated_at
)
SELECT 
  wi.id as item_id,
  'opening_stock'::stock_transaction_type as transaction_type,
  'manual'::stock_reference_type as reference_type,
  wi.current_stock as quantity_change,
  0 as quantity_before,
  wi.current_stock as quantity_after,
  'Opening stock balance (retroactive)' as notes,
  wi.company_id,
  wi.created_at,
  NOW()
FROM warehouse_items wi
WHERE wi.current_stock > 0
AND NOT EXISTS (
  SELECT 1 FROM stock_transactions st 
  WHERE st.item_id = wi.id 
  AND st.transaction_type = 'opening_stock'
);