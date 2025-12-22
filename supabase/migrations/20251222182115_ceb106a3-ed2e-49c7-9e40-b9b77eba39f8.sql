-- Backfill missing stock_transactions for existing construction material transactions
INSERT INTO stock_transactions (
  item_id,
  transaction_type,
  reference_type,
  reference_id,
  quantity_change,
  quantity_before,
  quantity_after,
  unit_cost,
  total_value,
  notes,
  company_id,
  created_at
)
SELECT 
  frmt.warehouse_item_id,
  CASE 
    WHEN frmt.transaction_type = 'return' THEN 'project_return'::stock_transaction_type
    WHEN frmt.transaction_type = 'issue' THEN 'project_issue'::stock_transaction_type
  END,
  'project'::stock_reference_type,
  frmt.id,
  CASE 
    WHEN frmt.transaction_type = 'return' THEN frmt.quantity
    WHEN frmt.transaction_type = 'issue' THEN -frmt.quantity
  END,
  COALESCE(frmt.previous_warehouse_stock, 0),
  COALESCE(frmt.new_warehouse_stock, 0),
  frmt.unit_cost,
  frmt.total_value,
  CASE 
    WHEN frmt.transaction_type = 'return' THEN 'Project Return: ' || COALESCE(frmt.notes, 'Material returned from project') || ' (Retroactive backfill)'
    WHEN frmt.transaction_type = 'issue' THEN 'Project Issue: ' || COALESCE(frmt.notes, 'Material issued to project') || ' (Retroactive backfill)'
  END,
  frmt.company_id,
  frmt.created_at
FROM floor_room_material_transactions frmt
WHERE frmt.transaction_type IN ('issue', 'return')
AND frmt.warehouse_item_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM stock_transactions st 
  WHERE st.reference_id = frmt.id 
  AND st.reference_type = 'project'
);