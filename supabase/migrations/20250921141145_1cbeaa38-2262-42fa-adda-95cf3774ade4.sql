-- Update existing companies with proper module assignments
UPDATE companies 
SET modules = ARRAY['finance', 'warehouse', 'sourcing', 'procurement', 'management', 'bom']
WHERE code = 'TUH';

UPDATE companies 
SET modules = ARRAY['warehouse', 'sourcing', 'procurement', 'bom']
WHERE code = 'BS';

-- Ensure any companies without modules get a default set
UPDATE companies 
SET modules = ARRAY['warehouse', 'procurement']
WHERE modules IS NULL OR modules = '{}' OR array_length(modules, 1) IS NULL;