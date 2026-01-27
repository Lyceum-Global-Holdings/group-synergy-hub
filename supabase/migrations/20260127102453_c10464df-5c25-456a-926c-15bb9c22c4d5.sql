-- Fix: Allow all authenticated users to view construction labour master for attendance tracking
-- Regular users need to see labour data to manage attendance in Daily Site Reports

-- Drop the overly restrictive policies
DROP POLICY IF EXISTS "HR and construction can view labour master" ON public.construction_labour_master;
DROP POLICY IF EXISTS "HR and managers can view labour master" ON public.construction_labour_master;

-- Create a more permissive SELECT policy that allows all authenticated users in the same company
-- This enables the Labour Attendance section to be visible to all users who have access to Daily Site Reports
CREATE POLICY "Authenticated users can view labour master for their company"
ON public.construction_labour_master
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  can_access_company(company_id)
);

-- Also ensure the attendance table policies are consistent
-- Update SELECT policy to ensure all authenticated users in the company can view attendance
DROP POLICY IF EXISTS "Users can view attendance for their company" ON public.site_report_labour_attendance;

CREATE POLICY "Authenticated users can view attendance for their company"
ON public.site_report_labour_attendance
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  can_access_company(company_id)
);

-- Ensure INSERT policy is properly scoped to company
DROP POLICY IF EXISTS "Users can create attendance for their company" ON public.site_report_labour_attendance;

CREATE POLICY "Authenticated users can create attendance for their company"
ON public.site_report_labour_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) OR
  can_access_company(company_id)
);