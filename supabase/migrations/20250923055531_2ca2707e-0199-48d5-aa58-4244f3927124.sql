-- Add warehouse_item_id to pr_items table for linking to warehouse master
ALTER TABLE pr_items ADD COLUMN warehouse_item_id UUID REFERENCES warehouse_items(id);
ALTER TABLE pr_items ADD COLUMN item_code TEXT;

-- Add warehouse_item_id to po_items table for linking to warehouse master  
ALTER TABLE po_items ADD COLUMN warehouse_item_id UUID REFERENCES warehouse_items(id);

-- Create indexes for better performance
CREATE INDEX idx_pr_items_warehouse_item_id ON pr_items(warehouse_item_id);
CREATE INDEX idx_po_items_warehouse_item_id ON po_items(warehouse_item_id);
CREATE INDEX idx_pr_items_item_code ON pr_items(item_code);
CREATE INDEX idx_po_items_item_code ON po_items(item_code);