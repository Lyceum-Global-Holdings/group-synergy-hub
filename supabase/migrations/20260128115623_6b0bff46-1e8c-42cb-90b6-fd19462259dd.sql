-- Clean up orphaned transfer records that have no items
DELETE FROM construction_inventory_transfers 
WHERE id NOT IN (
  SELECT DISTINCT transfer_id FROM construction_transfer_items WHERE transfer_id IS NOT NULL
)
AND id NOT IN (
  SELECT DISTINCT transfer_id FROM construction_inventory_transactions WHERE transfer_id IS NOT NULL
);