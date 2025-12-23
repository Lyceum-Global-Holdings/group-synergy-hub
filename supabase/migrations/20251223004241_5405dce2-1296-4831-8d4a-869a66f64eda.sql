-- Create trigger function to automatically create stock_transactions for room material transactions
CREATE OR REPLACE FUNCTION create_stock_transaction_for_room_material()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process issue and return transactions with a warehouse item
  IF NEW.transaction_type IN ('issue', 'return') AND NEW.warehouse_item_id IS NOT NULL THEN
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
      created_by
    ) VALUES (
      NEW.warehouse_item_id,
      CASE WHEN NEW.transaction_type = 'issue' THEN 'project_issue'::stock_transaction_type ELSE 'project_return'::stock_transaction_type END,
      'project'::stock_reference_type,
      NEW.id,
      CASE WHEN NEW.transaction_type = 'issue' THEN -NEW.quantity ELSE NEW.quantity END,
      COALESCE(NEW.previous_warehouse_stock, 0),
      COALESCE(NEW.new_warehouse_stock, 0),
      NEW.unit_cost,
      NEW.total_value,
      CASE 
        WHEN NEW.transaction_type = 'issue' THEN 'Project Issue: ' || COALESCE(NEW.notes, 'Material issued to project')
        ELSE 'Project Return: ' || COALESCE(NEW.notes, 'Material returned from project')
      END,
      NEW.company_id,
      COALESCE(auth.uid(), NEW.performed_by)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_create_stock_transaction_for_room_material ON floor_room_material_transactions;
CREATE TRIGGER trg_create_stock_transaction_for_room_material
AFTER INSERT ON floor_room_material_transactions
FOR EACH ROW
EXECUTE FUNCTION create_stock_transaction_for_room_material();

-- Backfill missing stock_transactions for existing floor_room_material_transactions
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
  created_by,
  created_at
)
SELECT 
  frmt.warehouse_item_id,
  CASE WHEN frmt.transaction_type = 'issue' THEN 'project_issue'::stock_transaction_type ELSE 'project_return'::stock_transaction_type END,
  'project'::stock_reference_type,
  frmt.id,
  CASE WHEN frmt.transaction_type = 'issue' THEN -frmt.quantity ELSE frmt.quantity END,
  COALESCE(frmt.previous_warehouse_stock, 0),
  COALESCE(frmt.new_warehouse_stock, 0),
  frmt.unit_cost,
  frmt.total_value,
  CASE 
    WHEN frmt.transaction_type = 'issue' THEN 'Project Issue: ' || COALESCE(frmt.notes, 'Material issued to project')
    ELSE 'Project Return: ' || COALESCE(frmt.notes, 'Material returned from project')
  END,
  frmt.company_id,
  frmt.performed_by,
  frmt.created_at
FROM floor_room_material_transactions frmt
WHERE frmt.transaction_type IN ('issue', 'return')
  AND frmt.warehouse_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM stock_transactions st 
    WHERE st.reference_id = frmt.id 
      AND st.reference_type = 'project'
  );