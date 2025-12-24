-- Add foreign key constraint from stock_transactions.item_id to warehouse_items.id
ALTER TABLE stock_transactions
ADD CONSTRAINT fk_stock_transactions_warehouse_items
FOREIGN KEY (item_id) REFERENCES warehouse_items(id);