-- Add warehouse_asset_id column to depreciation_schedule to link to individual physical assets
ALTER TABLE depreciation_schedule 
ADD COLUMN warehouse_asset_id UUID REFERENCES warehouse_assets(id);

-- Add index for performance
CREATE INDEX idx_depreciation_schedule_warehouse_asset ON depreciation_schedule(warehouse_asset_id);

-- Add warehouse_asset_id to asset_transactions for individual asset tracking
ALTER TABLE asset_transactions 
ADD COLUMN warehouse_asset_id UUID REFERENCES warehouse_assets(id);

-- Add index for performance
CREATE INDEX idx_asset_transactions_warehouse_asset ON asset_transactions(warehouse_asset_id);