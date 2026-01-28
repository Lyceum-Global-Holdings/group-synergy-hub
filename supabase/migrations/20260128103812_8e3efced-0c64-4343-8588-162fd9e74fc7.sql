
-- Add resource-allocation submodule and its children to Lyceum Nugegoda Quarters company
UPDATE companies 
SET modules = jsonb_set(
  modules,
  '{construction}',
  '["project-master", "work-orders", "site-management", "progress-tracking", "daily-reports", "resource-allocation", "labour", "inventory", "subcontractors", "quality-control", "safety-management", "project-documents", "project-budgeting", "reports-analytics"]'::jsonb
),
updated_at = NOW()
WHERE id = '11a46626-34c8-4ea8-8cc1-df0ec439fd48';
