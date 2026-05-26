
WITH missing AS (
  SELECT wi.id AS item_id, wi.company_id, wi.location_id, COALESCE(wi.current_stock, 0) AS qty
  FROM warehouse_items wi
  WHERE wi.location_id IS NOT NULL
    AND wi.company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM warehouse_bin_allocations wba WHERE wba.warehouse_item_id = wi.id
    )
),
picked AS (
  SELECT DISTINCT ON (m.item_id)
    m.item_id, m.company_id, m.location_id, m.qty, wb.id AS bin_id
  FROM missing m
  JOIN warehouse_bins wb
    ON wb.location_id = m.location_id
   AND (wb.company_id = m.company_id OR wb.is_shared = true)
   AND COALESCE(wb.status, 'active') <> 'inactive'
  ORDER BY m.item_id, (wb.company_id = m.company_id) DESC, wb.bin_code
)
INSERT INTO warehouse_bin_allocations
  (id, warehouse_item_id, bin_id, company_id, location_id,
   allocated_quantity, reserved_quantity, created_at, updated_at)
SELECT gen_random_uuid(), p.item_id, p.bin_id, p.company_id, p.location_id,
       p.qty, 0, now(), now()
FROM picked p
ON CONFLICT (warehouse_item_id, bin_id) DO NOTHING;
