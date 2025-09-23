-- Update companies table to support hierarchical module structure
-- Step 1: Drop the existing default
ALTER TABLE public.companies 
ALTER COLUMN modules DROP DEFAULT;

-- Step 2: Change column type from text[] to jsonb
ALTER TABLE public.companies 
ALTER COLUMN modules TYPE jsonb USING '{}'::jsonb;

-- Step 3: Set new default value
ALTER TABLE public.companies 
ALTER COLUMN modules SET DEFAULT '{}'::jsonb;