-- First, create the can_access_company helper function if it doesn't exist
CREATE OR REPLACE FUNCTION can_access_company(target_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_company_id UUID;
BEGIN
  -- Get the user's company_id from profiles
  SELECT company_id INTO user_company_id
  FROM profiles
  WHERE user_id = auth.uid();
  
  -- Super admins can access all companies
  IF is_super_admin(auth.uid()) THEN
    RETURN TRUE;
  END IF;
  
  -- Users can access their own company
  IF user_company_id = target_company_id THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create company_suppliers junction table for supplier allocation
CREATE TABLE IF NOT EXISTS company_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  allocation_type TEXT DEFAULT 'manual' CHECK (allocation_type IN ('manual', 'auto', 'inherited')),
  approved_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  allocated_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  allocated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  payment_terms TEXT,
  credit_limit NUMERIC,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, supplier_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_suppliers_company ON company_suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_company_suppliers_supplier ON company_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_company_suppliers_status ON company_suppliers(status);

-- Enable RLS
ALTER TABLE company_suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view allocations for their company
DROP POLICY IF EXISTS "Users can view company supplier allocations" ON company_suppliers;
CREATE POLICY "Users can view company supplier allocations"
ON company_suppliers
FOR SELECT
TO authenticated
USING (can_access_company(company_id));

-- RLS Policy: Only admins can allocate suppliers
DROP POLICY IF EXISTS "Admins can allocate suppliers to companies" ON company_suppliers;
CREATE POLICY "Admins can allocate suppliers to companies"
ON company_suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  (can_access_company(company_id) AND is_admin(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- RLS Policy: Only admins can update allocations
DROP POLICY IF EXISTS "Admins can update supplier allocations" ON company_suppliers;
CREATE POLICY "Admins can update supplier allocations"
ON company_suppliers
FOR UPDATE
TO authenticated
USING (
  (can_access_company(company_id) AND is_admin(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- RLS Policy: Only admins can remove allocations
DROP POLICY IF EXISTS "Admins can remove supplier allocations" ON company_suppliers;
CREATE POLICY "Admins can remove supplier allocations"
ON company_suppliers
FOR DELETE
TO authenticated
USING (
  (can_access_company(company_id) AND is_admin(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- Helper function to get approved suppliers for a company
CREATE OR REPLACE FUNCTION get_company_approved_suppliers(target_company_id UUID)
RETURNS TABLE (
  supplier_id UUID,
  supplier_code TEXT,
  supplier_name TEXT,
  supplier_type TEXT,
  is_preferred BOOLEAN,
  payment_terms TEXT,
  credit_limit NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.supplier_code,
    s.name,
    s.supplier_type,
    cs.is_preferred,
    COALESCE(cs.payment_terms, s.payment_terms) as payment_terms,
    COALESCE(cs.credit_limit, s.credit_limit) as credit_limit
  FROM suppliers s
  INNER JOIN company_suppliers cs ON s.id = cs.supplier_id
  WHERE cs.company_id = target_company_id
    AND cs.status = 'approved'
  ORDER BY cs.is_preferred DESC, s.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-allocate existing suppliers to all companies (approved)
-- This ensures existing data continues to work
INSERT INTO company_suppliers (company_id, supplier_id, status, allocation_type, allocated_at, approved_at)
SELECT 
  c.id as company_id,
  s.id as supplier_id,
  'approved' as status,
  'auto' as allocation_type,
  now() as allocated_at,
  now() as approved_at
FROM companies c
CROSS JOIN suppliers s
WHERE NOT EXISTS (
  SELECT 1 FROM company_suppliers cs 
  WHERE cs.company_id = c.id AND cs.supplier_id = s.id
)
ON CONFLICT (company_id, supplier_id) DO NOTHING;