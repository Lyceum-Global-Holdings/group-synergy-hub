-- Add batch-management submodule to all companies that have warehouse module enabled
UPDATE companies
SET modules = jsonb_set(
  modules,
  '{warehouse}',
  COALESCE(modules->'warehouse', '[]'::jsonb) || '["batch-management"]'::jsonb
)
WHERE modules ? 'warehouse'
  AND modules->'warehouse' IS NOT NULL
  AND NOT (modules->'warehouse' @> '"batch-management"');