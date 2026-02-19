ALTER TABLE material_requests 
ADD COLUMN location_id UUID REFERENCES warehouse_locations(id);