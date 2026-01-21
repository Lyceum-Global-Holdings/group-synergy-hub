-- Add serial_number column to construction_inventory_master
ALTER TABLE construction_inventory_master
ADD COLUMN serial_number text;