-- PHASE 1: CRITICAL SECURITY FIXES
-- This migration addresses the most critical security vulnerabilities

-- =============================================================================
-- STEP 0: ADD MISSING COMPANY_ID COLUMNS
-- =============================================================================
-- Add company_id to suppliers table if it doesn't exist
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);

-- =============================================================================
-- FIX 1: SECURE user_roles TABLE - PREVENT PRIVILEGE ESCALATION
-- =============================================================================
-- Drop the dangerous policy that allows any authenticated user to manage roles
DROP POLICY IF EXISTS "Authenticated users can manage user roles" ON public.user_roles;

-- Create admin-only policies for role management
CREATE POLICY "Only admins can assign roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can modify role assignments"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can remove role assignments"
ON public.user_roles
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Keep the SELECT policy so users can see their own roles
CREATE POLICY "Users can view their own roles, admins can view all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- =============================================================================
-- FIX 2: SECURE companies TABLE - IMPLEMENT COMPANY-LEVEL ISOLATION
-- =============================================================================
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can delete companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;

-- Only super admins and admins can view all companies
-- Regular users can only view their own company
CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
TO authenticated
USING (
  -- Super admins can view all companies
  is_super_admin(auth.uid())
  OR
  -- Admins can view all companies
  is_admin(auth.uid())
  OR
  -- Regular users can view their own company
  id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

-- Only super admins can create companies
CREATE POLICY "Only super admins can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- Only super admins and admins can update their own company
CREATE POLICY "Admins can update their own company"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR
  (is_admin(auth.uid()) AND id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  ))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  (is_admin(auth.uid()) AND id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  ))
);

-- Only super admins can delete companies
CREATE POLICY "Only super admins can delete companies"
ON public.companies
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

-- =============================================================================
-- FIX 3: RESTRICT PII ACCESS IN suppliers TABLE
-- =============================================================================
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;

-- Create company-scoped SELECT policy
CREATE POLICY "Users can view suppliers in their company"
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  -- Admins and super admins can view all suppliers
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR
  -- Regular users can only view suppliers in their company
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
  OR company_id IS NULL  -- For backwards compatibility
);

-- Update other supplier policies to respect company boundaries
DROP POLICY IF EXISTS "Authenticated users can create suppliers" ON public.suppliers;
CREATE POLICY "Users can create suppliers in their company"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = created_by)
  AND (
    is_admin(auth.uid())
    OR company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    )
    OR company_id IS NULL
  )
);

DROP POLICY IF EXISTS "Users can update suppliers they created or admins can update any" ON public.suppliers;
CREATE POLICY "Users can update suppliers in their company"
ON public.suppliers
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid())
  OR (
    auth.uid() = created_by 
    AND (
      company_id IN (
        SELECT company_id 
        FROM public.profiles 
        WHERE user_id = auth.uid()
      )
      OR company_id IS NULL
    )
  )
);

-- =============================================================================
-- FIX 4: RESTRICT PII ACCESS IN customers TABLE
-- =============================================================================
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

-- Create company-scoped SELECT policy
CREATE POLICY "Users can view customers in their company"
ON public.customers
FOR SELECT
TO authenticated
USING (
  -- Admins and super admins can view all customers
  is_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR
  -- Regular users can only view customers in their company
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
  OR company_id IS NULL  -- For backwards compatibility
);

-- Update other customer policies to respect company boundaries
DROP POLICY IF EXISTS "Users can create customers" ON public.customers;
CREATE POLICY "Users can create customers in their company"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = created_by)
  AND (
    is_admin(auth.uid())
    OR company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    )
    OR company_id IS NULL
  )
);

DROP POLICY IF EXISTS "Users can update customers they created or admins can update any" ON public.customers;
CREATE POLICY "Users can update customers in their company"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid())
  OR (
    auth.uid() = created_by 
    AND (
      company_id IN (
        SELECT company_id 
        FROM public.profiles 
        WHERE user_id = auth.uid()
      )
      OR company_id IS NULL
    )
  )
);

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================
COMMENT ON TABLE public.user_roles IS 'User role assignments with RLS policies enforcing admin-only management to prevent privilege escalation attacks.';
COMMENT ON TABLE public.companies IS 'Company data with RLS policies enforcing company-level isolation. Super admins can manage all companies, regular admins can manage their own company, users can view their own company only.';
COMMENT ON TABLE public.suppliers IS 'Supplier data with company-level isolation. Users can only access suppliers within their company.';
COMMENT ON TABLE public.customers IS 'Customer data with company-level isolation. Users can only access customers within their company.';