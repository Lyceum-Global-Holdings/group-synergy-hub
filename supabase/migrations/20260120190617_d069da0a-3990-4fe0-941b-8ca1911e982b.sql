-- Drop the dependent index first
DROP INDEX IF EXISTS idx_roles_name_trgm;

-- Create dedicated extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop extension from public and recreate in extensions schema
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION pg_trgm WITH SCHEMA extensions;

-- Grant usage on extensions schema to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;

-- Recreate the index using the extension from the new schema
CREATE INDEX idx_roles_name_trgm ON public.roles USING gin (name extensions.gin_trgm_ops);