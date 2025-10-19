-- Add HOD, Manager, and created_by columns to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS hod_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_hod ON companies(hod_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_manager ON companies(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON companies(created_by);

-- Create approval level enum
CREATE TYPE approval_level_type AS ENUM ('hod', 'manager', 'finance', 'procurement', 'custom');

-- Create company_approvers table for flexible multi-level approvals
CREATE TABLE company_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approval_level approval_level_type NOT NULL,
  department text,
  is_primary boolean DEFAULT false,
  can_approve_up_to_amount numeric(15,2),
  modules jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id, approval_level, department)
);

-- Add indexes
CREATE INDEX idx_company_approvers_company ON company_approvers(company_id);
CREATE INDEX idx_company_approvers_user ON company_approvers(user_id);
CREATE INDEX idx_company_approvers_level ON company_approvers(approval_level);

-- Enable RLS
ALTER TABLE company_approvers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_approvers
CREATE POLICY "Admins can manage company approvers"
ON company_approvers FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can view approvers for their company"
ON company_approvers FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Helper function: Get HOD for a company
CREATE OR REPLACE FUNCTION get_company_hod(p_company_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hod_user_id FROM companies WHERE id = p_company_id;
$$;

-- Helper function: Get Manager for a company
CREATE OR REPLACE FUNCTION get_company_manager(p_company_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT manager_user_id FROM companies WHERE id = p_company_id;
$$;

-- Helper function: Check if user is HOD for a company
CREATE OR REPLACE FUNCTION is_company_hod(p_user_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM companies 
    WHERE id = p_company_id AND hod_user_id = p_user_id
  );
$$;

-- Helper function: Check if user is Manager for a company
CREATE OR REPLACE FUNCTION is_company_manager(p_user_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM companies 
    WHERE id = p_company_id AND manager_user_id = p_user_id
  );
$$;

-- Helper function: Get all approvers for a company
CREATE OR REPLACE FUNCTION get_company_approvers(
  p_company_id uuid,
  p_approval_level approval_level_type DEFAULT NULL,
  p_department text DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  approval_level approval_level_type,
  department text,
  is_primary boolean,
  can_approve_up_to_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ca.user_id,
    p.full_name,
    p.email,
    ca.approval_level,
    ca.department,
    ca.is_primary,
    ca.can_approve_up_to_amount
  FROM company_approvers ca
  JOIN profiles p ON ca.user_id = p.user_id
  WHERE ca.company_id = p_company_id
    AND (p_approval_level IS NULL OR ca.approval_level = p_approval_level)
    AND (p_department IS NULL OR ca.department = p_department)
  ORDER BY ca.is_primary DESC, p.full_name;
$$;