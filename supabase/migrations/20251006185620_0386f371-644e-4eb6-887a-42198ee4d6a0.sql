-- Migration: Enhance warehouse_locations for comprehensive warehouse management
-- Add capacity tracking, contact information, physical address, and status management

-- Add new columns to warehouse_locations table
ALTER TABLE warehouse_locations 
  ADD COLUMN IF NOT EXISTS capacity NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS current_usage NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS physical_address TEXT,
  ADD COLUMN IF NOT EXISTS location_code TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add constraint for status field
ALTER TABLE warehouse_locations 
  DROP CONSTRAINT IF EXISTS warehouse_locations_status_check,
  ADD CONSTRAINT warehouse_locations_status_check 
  CHECK (status IN ('active', 'inactive', 'maintenance', 'closed'));

-- Add unique constraint for location_code (only if not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_locations_code_unique 
  ON warehouse_locations(location_code) 
  WHERE location_code IS NOT NULL;

-- Create index for status for faster filtering
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_status 
  ON warehouse_locations(status);

-- Create index for type for faster filtering
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_type 
  ON warehouse_locations(type);

-- Add comments for documentation
COMMENT ON COLUMN warehouse_locations.capacity IS 'Maximum storage capacity of the location (in cubic meters, sq feet, or units)';
COMMENT ON COLUMN warehouse_locations.current_usage IS 'Current usage of the location (calculated from stock levels)';
COMMENT ON COLUMN warehouse_locations.contact_person IS 'Person responsible for managing this location';
COMMENT ON COLUMN warehouse_locations.contact_phone IS 'Contact phone number for location manager';
COMMENT ON COLUMN warehouse_locations.physical_address IS 'Physical address of the warehouse location';
COMMENT ON COLUMN warehouse_locations.location_code IS 'Unique identifier/code for the location (e.g., WH-001, BAY-A12)';
COMMENT ON COLUMN warehouse_locations.status IS 'Current operational status of the location';

-- Update existing locations to have active status
UPDATE warehouse_locations 
SET status = 'active' 
WHERE status IS NULL;