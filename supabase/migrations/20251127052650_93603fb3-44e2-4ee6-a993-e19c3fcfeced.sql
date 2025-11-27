-- =====================================================
-- SECURITY FIX: Restrict supplier data to company scope
-- =====================================================
-- Currently, supplier_contacts, supplier_documents, and supplier_items
-- allow ANY authenticated user to view all records. This exposes:
-- - Vendor contact information (emails, phones)
-- - Supplier documents and certifications
-- - Supplier pricing and part numbers
--
-- This migration adds company-based filtering by linking through
-- the suppliers table which already has proper company restrictions.
-- =====================================================

-- 1. Fix supplier_contacts policies
-- Remove overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage supplier contacts" ON supplier_contacts;
DROP POLICY IF EXISTS "Authenticated users can view supplier contacts" ON supplier_contacts;

-- Add company-scoped policies
CREATE POLICY "Users can view supplier contacts for their company" 
ON supplier_contacts FOR SELECT 
USING (
  supplier_id IN (
    SELECT id FROM suppliers 
    WHERE company_id = ANY(get_user_company_ids(auth.uid()))
    OR company_id IS NULL
    OR is_admin(auth.uid())
  )
);

CREATE POLICY "Users can create supplier contacts for their company"
ON supplier_contacts FOR INSERT
WITH CHECK (
  supplier_id IN (
    SELECT id FROM suppliers 
    WHERE company_id = ANY(get_user_company_ids(auth.uid()))
    OR is_admin(auth.uid())
  )
);

CREATE POLICY "Users can update supplier contacts for their company"
ON supplier_contacts FOR UPDATE
USING (
  supplier_id IN (
    SELECT id FROM suppliers 
    WHERE company_id = ANY(get_user_company_ids(auth.uid()))
    OR is_admin(auth.uid())
  )
);

CREATE POLICY "Users can delete supplier contacts for their company"
ON supplier_contacts FOR DELETE
USING (
  supplier_id IN (
    SELECT id FROM suppliers 
    WHERE company_id = ANY(get_user_company_ids(auth.uid()))
    OR is_admin(auth.uid())
  )
);

-- 2. Fix supplier_documents policies
-- Remove overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view documents" ON supplier_documents;

-- Add company-scoped policy (keep existing admin policies)
CREATE POLICY "Users can view supplier documents for their company" 
ON supplier_documents FOR SELECT 
USING (
  supplier_id IN (
    SELECT id FROM suppliers 
    WHERE company_id = ANY(get_user_company_ids(auth.uid()))
    OR company_id IS NULL
    OR is_admin(auth.uid())
  )
);

-- 3. Fix supplier_items policies
-- Remove overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view supplier items" ON supplier_items;

-- Add company-scoped policy
CREATE POLICY "Users can view supplier items for their company" 
ON supplier_items FOR SELECT 
USING (
  supplier_id IN (
    SELECT id FROM suppliers 
    WHERE company_id = ANY(get_user_company_ids(auth.uid()))
    OR is_admin(auth.uid())
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Users can view supplier contacts for their company" ON supplier_contacts IS 
'Security fix: Restricts supplier contact access to users within the same company or admins';
COMMENT ON POLICY "Users can view supplier documents for their company" ON supplier_documents IS 
'Security fix: Restricts supplier document access to users within the same company or admins';
COMMENT ON POLICY "Users can view supplier items for their company" ON supplier_items IS 
'Security fix: Restricts supplier items access to users within the same company or admins';