-- Fix existing warehouse_bin_allocations with NULL company_id
-- Set company_id to match the associated warehouse_item's company_id
UPDATE warehouse_bin_allocations wba
SET company_id = wi.company_id
FROM warehouse_items wi
WHERE wba.warehouse_item_id = wi.id
  AND wba.company_id IS NULL
  AND wi.company_id IS NOT NULL;