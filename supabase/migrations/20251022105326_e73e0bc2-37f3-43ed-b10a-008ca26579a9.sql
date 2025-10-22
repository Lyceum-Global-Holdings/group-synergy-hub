-- Comprehensive fix for all finished_goods foreign key constraints
-- Changes ON DELETE NO ACTION to ON DELETE SET NULL to allow finished goods deletion
-- while preserving transactional records for audit purposes

-- 1. Bill of Materials
ALTER TABLE bill_of_materials
DROP CONSTRAINT IF EXISTS bill_of_materials_finished_good_id_fkey;

ALTER TABLE bill_of_materials
ADD CONSTRAINT bill_of_materials_finished_good_id_fkey
FOREIGN KEY (finished_good_id)
REFERENCES finished_goods(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT bill_of_materials_finished_good_id_fkey ON bill_of_materials IS 
'ON DELETE SET NULL preserves BOMs when finished good is deleted. ON UPDATE CASCADE keeps references synchronized.';

-- 2. Delivery Order Items
ALTER TABLE delivery_order_items
DROP CONSTRAINT IF EXISTS delivery_order_items_finished_good_id_fkey;

ALTER TABLE delivery_order_items
ADD CONSTRAINT delivery_order_items_finished_good_id_fkey
FOREIGN KEY (finished_good_id)
REFERENCES finished_goods(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT delivery_order_items_finished_good_id_fkey ON delivery_order_items IS 
'ON DELETE SET NULL preserves delivery items when finished good is deleted. ON UPDATE CASCADE keeps references synchronized.';

-- 3. Finished Goods Issue Items
ALTER TABLE finished_goods_issue_items
DROP CONSTRAINT IF EXISTS finished_goods_issue_items_finished_good_id_fkey;

ALTER TABLE finished_goods_issue_items
ADD CONSTRAINT finished_goods_issue_items_finished_good_id_fkey
FOREIGN KEY (finished_good_id)
REFERENCES finished_goods(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT finished_goods_issue_items_finished_good_id_fkey ON finished_goods_issue_items IS 
'ON DELETE SET NULL preserves issue items when finished good is deleted. ON UPDATE CASCADE keeps references synchronized.';

-- 4. Packing List Items
ALTER TABLE packing_list_items
DROP CONSTRAINT IF EXISTS packing_list_items_finished_good_id_fkey;

ALTER TABLE packing_list_items
ADD CONSTRAINT packing_list_items_finished_good_id_fkey
FOREIGN KEY (finished_good_id)
REFERENCES finished_goods(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT packing_list_items_finished_good_id_fkey ON packing_list_items IS 
'ON DELETE SET NULL preserves packing items when finished good is deleted. ON UPDATE CASCADE keeps references synchronized.';

-- 5. Pick List Items
ALTER TABLE pick_list_items
DROP CONSTRAINT IF EXISTS pick_list_items_finished_good_id_fkey;

ALTER TABLE pick_list_items
ADD CONSTRAINT pick_list_items_finished_good_id_fkey
FOREIGN KEY (finished_good_id)
REFERENCES finished_goods(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT pick_list_items_finished_good_id_fkey ON pick_list_items IS 
'ON DELETE SET NULL preserves pick items when finished good is deleted. ON UPDATE CASCADE keeps references synchronized.';

-- 6. Purchase Request Items
ALTER TABLE pr_items
DROP CONSTRAINT IF EXISTS pr_items_finished_good_id_fkey;

ALTER TABLE pr_items
ADD CONSTRAINT pr_items_finished_good_id_fkey
FOREIGN KEY (finished_good_id)
REFERENCES finished_goods(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT pr_items_finished_good_id_fkey ON pr_items IS 
'ON DELETE SET NULL preserves PR items when finished good is deleted. ON UPDATE CASCADE keeps references synchronized.';

-- 7. Sales Order Items
ALTER TABLE sales_order_items
DROP CONSTRAINT IF EXISTS sales_order_items_finished_good_id_fkey;

ALTER TABLE sales_order_items
ADD CONSTRAINT sales_order_items_finished_good_id_fkey
FOREIGN KEY (finished_good_id)
REFERENCES finished_goods(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT sales_order_items_finished_good_id_fkey ON sales_order_items IS 
'ON DELETE SET NULL preserves sales order items when finished good is deleted. ON UPDATE CASCADE keeps references synchronized.';

-- 8. Customer PO Items
ALTER TABLE customer_po_items
DROP CONSTRAINT IF EXISTS customer_po_items_finished_good_id_fkey;

ALTER TABLE customer_po_items
ADD CONSTRAINT customer_po_items_finished_good_id_fkey
FOREIGN KEY (finished_good_id)
REFERENCES finished_goods(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT customer_po_items_finished_good_id_fkey ON customer_po_items IS 
'ON DELETE SET NULL preserves customer PO items when finished good is deleted. ON UPDATE CASCADE keeps references synchronized.';