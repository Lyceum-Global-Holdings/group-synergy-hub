-- Add material_type and measurement_type columns to suppliers table
ALTER TABLE suppliers 
ADD COLUMN material_type TEXT,
ADD COLUMN measurement_type TEXT;