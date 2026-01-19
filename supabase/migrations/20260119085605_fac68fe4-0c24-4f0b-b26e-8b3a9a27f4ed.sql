-- Drop the existing check constraint and recreate with additional transaction types
ALTER TABLE public.construction_inventory_transactions 
DROP CONSTRAINT IF EXISTS construction_inventory_transactions_transaction_type_check;

ALTER TABLE public.construction_inventory_transactions
ADD CONSTRAINT construction_inventory_transactions_transaction_type_check 
CHECK (transaction_type IN ('stock_addition', 'stock_removal', 'transfer', 'adjustment', 'allocation', 'return', 'repair_sent', 'repair_returned', 'new_item'));