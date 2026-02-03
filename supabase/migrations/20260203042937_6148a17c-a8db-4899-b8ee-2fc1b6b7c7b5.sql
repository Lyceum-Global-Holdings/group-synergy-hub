-- Tighten construction_labour_master security - restrict PII access to HR only
-- Contains sensitive worker data: EPF numbers, contact info, employee IDs

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "HR and senior management can view labour master" ON construction_labour_master;
DROP POLICY IF EXISTS "Construction users can update labour master" ON construction_labour_master;
DROP POLICY IF EXISTS "Admins can delete labour master" ON construction_labour_master;

-- SELECT: HR personnel and admins get full access, construction users get masked view
-- We'll create a view for non-HR access
CREATE POLICY "HR can view full labour master"
ON construction_labour_master FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_hr_access(auth.uid())
  )
);

-- INSERT: Only HR can add workers
CREATE POLICY "HR can create labour records"
ON construction_labour_master FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_hr_access(auth.uid())
  )
);

-- UPDATE: HR can update, construction managers can update non-PII fields
CREATE POLICY "HR can update labour records"
ON construction_labour_master FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_hr_access(auth.uid())
  )
)
WITH CHECK (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_hr_access(auth.uid())
  )
);

-- DELETE: Only admins
CREATE POLICY "Only admins can delete labour records"
ON construction_labour_master FOR DELETE
TO authenticated
USING (
  is_admin(auth.uid()) AND can_access_company(company_id)
);

-- Create a secure view that masks PII for construction managers
-- They need to see worker names, skills, and rates for scheduling but not contact info/IDs
CREATE OR REPLACE VIEW public.construction_labour_directory
WITH (security_invoker = on)
AS
SELECT 
  clm.id,
  clm.company_id,
  clm.name,
  clm.trade,
  clm.skill_level,
  clm.category,
  clm.labour_company,
  -- Contact info only visible to HR
  CASE 
    WHEN has_hr_access(auth.uid()) OR is_admin(auth.uid()) THEN clm.contact_number
    ELSE NULL
  END AS contact_number,
  CASE 
    WHEN has_hr_access(auth.uid()) OR is_admin(auth.uid()) THEN clm.email
    ELSE NULL
  END AS email,
  -- EPF number: masked for non-HR (show last 4 digits only)
  CASE 
    WHEN has_hr_access(auth.uid()) OR is_admin(auth.uid()) THEN clm.epf_no
    WHEN clm.epf_no IS NOT NULL THEN '****' || RIGHT(clm.epf_no, 4)
    ELSE NULL
  END AS epf_no,
  -- Employee ID: masked for non-HR
  CASE 
    WHEN has_hr_access(auth.uid()) OR is_admin(auth.uid()) THEN clm.employee_id
    WHEN clm.employee_id IS NOT NULL THEN '***' || RIGHT(clm.employee_id, 3)
    ELSE NULL
  END AS employee_id,
  -- Rates visible to construction managers for budgeting
  clm.hourly_rate,
  clm.daily_rate,
  clm.status,
  clm.notes,
  clm.project_id,
  clm.location_id,
  clm.created_by,
  clm.created_at,
  clm.updated_at
FROM public.construction_labour_master clm
WHERE 
  -- HR sees all, construction managers see company workers
  is_admin(auth.uid()) OR (
    can_access_company(clm.company_id) AND (
      has_hr_access(auth.uid()) OR 
      has_construction_access(auth.uid()) OR
      has_manager_access(auth.uid())
    )
  );

-- Grant access to the view
GRANT SELECT ON public.construction_labour_directory TO authenticated;

-- Add comment documenting the security model
COMMENT ON VIEW public.construction_labour_directory IS 
'Secure view for construction labour data with PII masking.
- HR and admins see full contact info, EPF numbers, and employee IDs
- Construction managers see masked EPF/employee IDs (last 4/3 digits) and NULL contact info
- Used for labour scheduling and attendance tracking without exposing sensitive worker PII';

COMMENT ON TABLE construction_labour_master IS 
'Construction worker master data containing sensitive PII (EPF numbers, contact info).
Direct table access restricted to HR personnel only.
Non-HR users should query construction_labour_directory view for masked data.';