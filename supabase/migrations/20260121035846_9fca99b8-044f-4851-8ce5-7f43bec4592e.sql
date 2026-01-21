-- Fix bank_accounts table RLS policies to restrict access to finance personnel only
-- This prevents unauthorized access to sensitive banking information

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view bank accounts" ON public.bank_accounts;

-- Create restrictive SELECT policy - only finance personnel and admins can view
CREATE POLICY "Finance personnel can view bank accounts"
ON public.bank_accounts FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- Ensure INSERT is also restricted to finance personnel
DROP POLICY IF EXISTS "Users can create bank accounts" ON public.bank_accounts;
CREATE POLICY "Finance personnel can create bank accounts"
ON public.bank_accounts FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- Ensure UPDATE is restricted to finance personnel
DROP POLICY IF EXISTS "Users can update bank accounts" ON public.bank_accounts;
CREATE POLICY "Finance personnel can update bank accounts"
ON public.bank_accounts FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- Restrict DELETE to admins only
DROP POLICY IF EXISTS "Users can delete bank accounts" ON public.bank_accounts;
CREATE POLICY "Admins can delete bank accounts"
ON public.bank_accounts FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    is_admin(auth.uid())
  )
);