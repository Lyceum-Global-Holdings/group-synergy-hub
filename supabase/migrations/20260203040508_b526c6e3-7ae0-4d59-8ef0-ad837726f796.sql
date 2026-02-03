-- Fix RLS policies for budgets table to restrict access to same company users with appropriate roles

-- Drop existing overly permissive policies if any
DROP POLICY IF EXISTS "Authenticated users can view budgets" ON budgets;
DROP POLICY IF EXISTS "Users can view budgets" ON budgets;
DROP POLICY IF EXISTS "Company users can view budgets" ON budgets;

-- Create secure SELECT policy - only finance, managers, and admins within the same company
CREATE POLICY "Authorized users can view company budgets"
ON budgets FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR has_manager_access(auth.uid())))
);

-- Create secure INSERT policy - only finance and admins can create budgets
CREATE POLICY "Finance users can create budgets"
ON budgets FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- Create secure UPDATE policy - only finance and admins can update budgets
CREATE POLICY "Finance users can update budgets"
ON budgets FOR UPDATE
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()))
)
WITH CHECK (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()))
);