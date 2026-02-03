-- Tighten customer_invoices security - restrict to accounts receivable/senior finance only
-- This table contains sensitive revenue and pricing data

-- Drop existing policies
DROP POLICY IF EXISTS "Only admins can delete customer invoices" ON customer_invoices;
DROP POLICY IF EXISTS "Finance can view customer invoices" ON customer_invoices;
DROP POLICY IF EXISTS "Finance can insert customer invoices" ON customer_invoices;
DROP POLICY IF EXISTS "Finance can update customer invoices" ON customer_invoices;

-- SELECT: Only senior finance, sales management, and admins can view invoices
-- Regular finance/procurement users should NOT have access to customer pricing data
CREATE POLICY "Senior finance can view customer invoices"
ON customer_invoices FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND (
      -- Senior finance (accounts receivable team)
      has_senior_finance_access(auth.uid()) OR
      -- Sales management can view their customers' invoices
      has_sales_access(auth.uid())
    )
  )
);

-- INSERT: Only senior finance can create invoices
CREATE POLICY "Senior finance can create customer invoices"
ON customer_invoices FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_senior_finance_access(auth.uid())
  )
);

-- UPDATE: Only senior finance can update invoices
CREATE POLICY "Senior finance can update customer invoices"
ON customer_invoices FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_senior_finance_access(auth.uid())
  )
)
WITH CHECK (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_senior_finance_access(auth.uid())
  )
);

-- DELETE: Only admins can delete invoices (audit trail protection)
CREATE POLICY "Only admins can delete customer invoices"
ON customer_invoices FOR DELETE
TO authenticated
USING (
  is_admin(auth.uid()) AND can_access_company(company_id)
);

-- Also secure customer_invoice_items if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_invoice_items' AND table_schema = 'public') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Senior finance can view invoice items" ON customer_invoice_items;
    DROP POLICY IF EXISTS "Senior finance can manage invoice items" ON customer_invoice_items;
    
    -- Enable RLS if not already
    ALTER TABLE customer_invoice_items ENABLE ROW LEVEL SECURITY;
    
    -- SELECT: Inherit from parent invoice access
    EXECUTE 'CREATE POLICY "Senior finance can view invoice items"
    ON customer_invoice_items FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM customer_invoices ci 
        WHERE ci.id = customer_invoice_items.invoice_id
        AND (
          is_admin(auth.uid()) OR (
            can_access_company(ci.company_id) AND (
              has_senior_finance_access(auth.uid()) OR has_sales_access(auth.uid())
            )
          )
        )
      )
    )';
    
    -- INSERT/UPDATE/DELETE: Senior finance only
    EXECUTE 'CREATE POLICY "Senior finance can manage invoice items"
    ON customer_invoice_items FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM customer_invoices ci 
        WHERE ci.id = customer_invoice_items.invoice_id
        AND (
          is_admin(auth.uid()) OR (
            can_access_company(ci.company_id) AND has_senior_finance_access(auth.uid())
          )
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM customer_invoices ci 
        WHERE ci.id = customer_invoice_items.invoice_id
        AND (
          is_admin(auth.uid()) OR (
            can_access_company(ci.company_id) AND has_senior_finance_access(auth.uid())
          )
        )
      )
    )';
  END IF;
END $$;

-- Add comment documenting the security model
COMMENT ON TABLE customer_invoices IS 
'Customer invoices containing sensitive revenue and pricing data. 
Access restricted to senior finance (accounts receivable), sales management, and admins only.
Regular finance and procurement users do NOT have access to protect competitive pricing information.';