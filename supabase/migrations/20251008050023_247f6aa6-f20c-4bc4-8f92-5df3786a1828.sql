-- Drop existing check constraint
ALTER TABLE finished_goods_movements 
DROP CONSTRAINT finished_goods_movements_reference_type_check;

-- Add new check constraint that includes 'batch'
ALTER TABLE finished_goods_movements 
ADD CONSTRAINT finished_goods_movements_reference_type_check 
CHECK (reference_type IN (
  'production_order', 
  'sales_order', 
  'transfer_order', 
  'adjustment', 
  'return_note',
  'batch'
));