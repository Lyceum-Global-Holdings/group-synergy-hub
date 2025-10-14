-- Add foreign key for finished_goods.warehouse_item_id to warehouse_items
ALTER TABLE finished_goods
ADD CONSTRAINT fk_finished_goods_warehouse_item
FOREIGN KEY (warehouse_item_id) 
REFERENCES warehouse_items(id)
ON DELETE SET NULL;

-- Add foreign key for pick_lists.picker_id to profiles
ALTER TABLE pick_lists
ADD CONSTRAINT fk_pick_lists_picker
FOREIGN KEY (picker_id) 
REFERENCES profiles(id)
ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_finished_goods_warehouse_item_id 
ON finished_goods(warehouse_item_id);

CREATE INDEX IF NOT EXISTS idx_pick_lists_picker_id 
ON pick_lists(picker_id);