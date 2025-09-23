-- Update companies table to support hierarchical module structure
-- Change modules column from text[] to jsonb
ALTER TABLE public.companies 
ALTER COLUMN modules TYPE jsonb USING 
CASE 
  WHEN modules IS NULL THEN '{}'::jsonb
  ELSE '{}'::jsonb
END;

-- Update the default value
ALTER TABLE public.companies 
ALTER COLUMN modules SET DEFAULT '{}'::jsonb;