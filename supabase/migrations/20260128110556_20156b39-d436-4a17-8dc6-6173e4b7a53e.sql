-- Update repair records that have null company_id but their item_master has a company_id
UPDATE construction_repair_records r
SET company_id = im.company_id
FROM construction_item_master im
WHERE r.item_master_id = im.id
  AND r.company_id IS NULL
  AND im.company_id IS NOT NULL;

-- Delete duplicate repair records for the same serial number (keep only the first one)
DELETE FROM construction_repair_records
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY serial_number_id, status
             ORDER BY created_at ASC
           ) as rn
    FROM construction_repair_records
    WHERE status NOT IN ('returned', 'discarded')
  ) subquery
  WHERE rn > 1
);

-- Also clean up duplicate transaction records for repair_sent with same serial on same date
DELETE FROM construction_inventory_transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY serial_number_id, transaction_type, DATE(transaction_date)
             ORDER BY created_at ASC
           ) as rn
    FROM construction_inventory_transactions
    WHERE transaction_type = 'repair_sent'
  ) subquery
  WHERE rn > 1
);