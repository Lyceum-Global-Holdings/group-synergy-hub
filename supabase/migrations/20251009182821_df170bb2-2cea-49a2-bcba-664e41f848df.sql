-- Add sales_order_item_id to pick_list_items
ALTER TABLE pick_list_items 
ADD COLUMN sales_order_item_id UUID REFERENCES sales_order_items(id);

CREATE INDEX idx_pick_list_items_so_item 
ON pick_list_items(sales_order_item_id);

-- Add quantity_picked column to sales_order_items if not exists
ALTER TABLE sales_order_items 
ADD COLUMN IF NOT EXISTS quantity_picked NUMERIC DEFAULT 0;

-- Trigger to sync picked quantities back to sales order items
CREATE OR REPLACE FUNCTION update_so_item_on_pick()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity_picked != OLD.quantity_picked THEN
    UPDATE sales_order_items
    SET 
      quantity_picked = quantity_picked + (NEW.quantity_picked - OLD.quantity_picked),
      status = CASE
        WHEN quantity_picked + (NEW.quantity_picked - OLD.quantity_picked) >= quantity_ordered THEN 'picked'
        WHEN quantity_picked + (NEW.quantity_picked - OLD.quantity_picked) > 0 THEN 'partial'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.sales_order_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_so_item_on_pick
  AFTER UPDATE ON pick_list_items
  FOR EACH ROW
  WHEN (NEW.quantity_picked IS DISTINCT FROM OLD.quantity_picked)
  EXECUTE FUNCTION update_so_item_on_pick();