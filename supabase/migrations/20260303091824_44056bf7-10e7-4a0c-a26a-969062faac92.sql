
-- Migrate all construction inventory data from Lyceum Nugegoda Quarters to VeBuild
-- Items
UPDATE construction_item_master 
SET company_id = '39ff33f9-b9c1-4757-8b26-dd65a6ef7f98' 
WHERE company_id = '11a46626-34c8-4ea8-8cc1-df0ec439fd48';

-- Serial numbers
UPDATE construction_serial_numbers 
SET company_id = '39ff33f9-b9c1-4757-8b26-dd65a6ef7f98' 
WHERE company_id = '11a46626-34c8-4ea8-8cc1-df0ec439fd48';

-- Inventory stock
UPDATE construction_inventory_stock 
SET company_id = '39ff33f9-b9c1-4757-8b26-dd65a6ef7f98' 
WHERE company_id = '11a46626-34c8-4ea8-8cc1-df0ec439fd48';
