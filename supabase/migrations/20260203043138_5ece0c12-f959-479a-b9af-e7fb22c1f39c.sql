-- Tighten customers table security - restrict PII access to sales team only
-- Contains sensitive data: email, phone, address, tax IDs, passport numbers

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authorized users can view customers" ON customers;
DROP POLICY IF EXISTS "Company users can create customers" ON customers;
DROP POLICY IF EXISTS "Company users can update customers" ON customers;
DROP POLICY IF EXISTS "Users can create customers in their company" ON customers;
DROP POLICY IF EXISTS "Users can update customers in their company" ON customers;
DROP POLICY IF EXISTS "Admins only can delete customers" ON customers;

-- SELECT: Sales team gets full access, others get restricted view
CREATE POLICY "Sales team can view full customer data"
ON customers FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_sales_access(auth.uid())
  )
);

-- INSERT: Only sales team can create customers
CREATE POLICY "Sales team can create customers"
ON customers FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_sales_access(auth.uid())
  )
);

-- UPDATE: Only sales team can update customers
CREATE POLICY "Sales team can update customers"
ON customers FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_sales_access(auth.uid())
  )
)
WITH CHECK (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_sales_access(auth.uid())
  )
);

-- DELETE: Only admins
CREATE POLICY "Only admins can delete customers"
ON customers FOR DELETE
TO authenticated
USING (
  is_admin(auth.uid()) AND can_access_company(company_id)
);

-- Create a secure view that masks PII for non-sales users (finance needs customer names for invoicing)
CREATE OR REPLACE VIEW public.customers_directory
WITH (security_invoker = on)
AS
SELECT 
  c.id,
  c.customer_code,
  c.customer_name,
  c.customer_type,
  c.company_id,
  c.status,
  c.created_at,
  c.updated_at,
  c.sap_customer_code,
  c.sap_sync_status,
  -- Contact person name visible to all authorized users
  c.contact_person,
  c.first_name,
  c.last_name,
  -- Contact details only visible to sales team
  CASE 
    WHEN has_sales_access(auth.uid()) OR is_admin(auth.uid()) THEN c.email
    ELSE NULL
  END AS email,
  CASE 
    WHEN has_sales_access(auth.uid()) OR is_admin(auth.uid()) THEN c.phone
    ELSE NULL
  END AS phone,
  CASE 
    WHEN has_sales_access(auth.uid()) OR is_admin(auth.uid()) THEN c.address
    ELSE NULL
  END AS address,
  -- Tax/registration info: masked for non-sales (show partial for finance reference)
  CASE 
    WHEN has_sales_access(auth.uid()) OR is_admin(auth.uid()) THEN c.tax_id
    WHEN c.tax_id IS NOT NULL AND has_finance_access(auth.uid()) THEN '****' || RIGHT(c.tax_id, 4)
    ELSE NULL
  END AS tax_id,
  CASE 
    WHEN has_sales_access(auth.uid()) OR is_admin(auth.uid()) THEN c.registration_number
    WHEN c.registration_number IS NOT NULL AND has_finance_access(auth.uid()) THEN '****' || RIGHT(c.registration_number, 4)
    ELSE NULL
  END AS registration_number,
  -- Highly sensitive ID numbers: sales only
  CASE 
    WHEN has_sales_access(auth.uid()) OR is_admin(auth.uid()) THEN c.id_passport_number
    ELSE NULL
  END AS id_passport_number,
  -- Document URL: sales only
  CASE 
    WHEN has_sales_access(auth.uid()) OR is_admin(auth.uid()) THEN c.company_registration_document_url
    ELSE NULL
  END AS company_registration_document_url,
  c.created_by
FROM public.customers c
WHERE 
  is_admin(auth.uid()) OR (
    can_access_company(c.company_id) AND (
      has_sales_access(auth.uid()) OR 
      has_finance_access(auth.uid()) OR
      has_manager_access(auth.uid())
    )
  );

-- Grant access to the view
GRANT SELECT ON public.customers_directory TO authenticated;

-- Add comments documenting the security model
COMMENT ON VIEW public.customers_directory IS 
'Secure view for customer data with PII masking.
- Sales team and admins see full contact info, tax IDs, and documents
- Finance sees customer names, codes, and masked tax IDs (last 4 digits) for AR/AP
- Managers see customer names and codes for reporting
- Used for non-sales modules that need customer references without full PII';

COMMENT ON TABLE customers IS 
'Customer master data containing sensitive PII (contact info, tax IDs, passport numbers).
Direct table access restricted to sales team only.
Non-sales users should query customers_directory view for masked data.';