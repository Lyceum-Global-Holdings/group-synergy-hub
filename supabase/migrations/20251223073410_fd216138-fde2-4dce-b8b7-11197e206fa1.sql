-- Update all project_floor_drawings records that have NULL company_id
-- by getting the company_id from their parent construction_projects
UPDATE project_floor_drawings pfd
SET company_id = cp.company_id
FROM construction_projects cp
WHERE pfd.project_id = cp.id
AND pfd.company_id IS NULL;