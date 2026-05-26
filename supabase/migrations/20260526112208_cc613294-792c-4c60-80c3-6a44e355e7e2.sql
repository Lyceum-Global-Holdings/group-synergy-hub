
-- 1. Null out bin_id on transactions pointing to SYS-LEGACY bins
UPDATE stock_transactions st
SET bin_id = NULL
FROM warehouse_bins wb
WHERE st.bin_id = wb.id AND wb.bin_code = 'SYS-LEGACY';

-- 2. Null out location_id on transactions pointing to SYS-LEGACY locations
UPDATE stock_transactions st
SET location_id = NULL
FROM warehouse_locations wl
WHERE st.location_id = wl.id AND wl.name = 'SYS-LEGACY';

-- 3. Delete SYS-LEGACY allocations
DELETE FROM warehouse_bin_allocations wba
USING warehouse_bins wb
WHERE wba.bin_id = wb.id AND wb.bin_code = 'SYS-LEGACY';

-- 4. Delete SYS-LEGACY bins
DELETE FROM warehouse_bins WHERE bin_code = 'SYS-LEGACY';

-- 5. Delete SYS-LEGACY locations
DELETE FROM warehouse_locations WHERE name = 'SYS-LEGACY';
