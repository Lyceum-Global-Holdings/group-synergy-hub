-- Clear all construction inventory data to start fresh
-- First, delete dependent transaction records
DELETE FROM construction_inventory_transactions WHERE id IS NOT NULL;

-- Delete repair records
DELETE FROM construction_repair_records WHERE id IS NOT NULL;

-- Delete main inventory master records
DELETE FROM construction_inventory_master WHERE id IS NOT NULL;