-- ============================================
-- SAP COMPATIBILITY MIGRATION
-- Add SAP integration fields and tighten SAP table policies
-- ============================================

-- 1. Add SAP document reference fields to purchase_orders
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS sap_document_number text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sap_last_sync_at timestamptz;

-- 2. Add SAP document reference fields to supplier_invoices
ALTER TABLE supplier_invoices 
ADD COLUMN IF NOT EXISTS sap_document_number text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sap_last_sync_at timestamptz;

-- 3. Add SAP document reference fields to customer_invoices
ALTER TABLE customer_invoices 
ADD COLUMN IF NOT EXISTS sap_document_number text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sap_last_sync_at timestamptz;

-- 4. Add SAP vendor code to suppliers
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS sap_vendor_code text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending';

-- 5. Add SAP customer code to customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS sap_customer_code text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending';

-- 6. Create indexes for SAP sync queries (partial indexes for pending items)
CREATE INDEX IF NOT EXISTS idx_po_sap_sync_pending ON purchase_orders(sap_sync_status) 
WHERE sap_sync_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_si_sap_sync_pending ON supplier_invoices(sap_sync_status) 
WHERE sap_sync_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ci_sap_sync_pending ON customer_invoices(sap_sync_status) 
WHERE sap_sync_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_suppliers_sap_sync_pending ON suppliers(sap_sync_status) 
WHERE sap_sync_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_customers_sap_sync_pending ON customers(sap_sync_status) 
WHERE sap_sync_status = 'pending';

-- 7. Create index for SAP document number lookups
CREATE INDEX IF NOT EXISTS idx_po_sap_doc_number ON purchase_orders(sap_document_number) 
WHERE sap_document_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_si_sap_doc_number ON supplier_invoices(sap_document_number) 
WHERE sap_document_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ci_sap_doc_number ON customer_invoices(sap_document_number) 
WHERE sap_document_number IS NOT NULL;

-- 8. Tighten SAP entity mappings RLS policy
DROP POLICY IF EXISTS "Company users can view SAP mappings" ON sap_entity_mappings;
DROP POLICY IF EXISTS "Finance and admin can view SAP mappings" ON sap_entity_mappings;
CREATE POLICY "Finance and admin can view SAP mappings"
ON sap_entity_mappings FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR has_module_access(auth.uid(), 'sap-integration')))
);

-- 9. Tighten SAP sync logs RLS policy
DROP POLICY IF EXISTS "Company users can view sync logs" ON sap_sync_logs;
DROP POLICY IF EXISTS "Finance and admin can view sync logs" ON sap_sync_logs;
CREATE POLICY "Finance and admin can view sync logs"
ON sap_sync_logs FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR has_module_access(auth.uid(), 'sap-integration')))
);

-- 10. Create function to update SAP sync status
CREATE OR REPLACE FUNCTION update_sap_sync_status(
  _table_name text,
  _record_id uuid,
  _status text,
  _sap_doc_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET sap_sync_status = $1, sap_last_sync_at = now(), sap_document_number = COALESCE($2, sap_document_number) WHERE id = $3',
    _table_name
  ) USING _status, _sap_doc_number, _record_id;
END;
$$;

-- 11. Create function to get pending SAP sync items
CREATE OR REPLACE FUNCTION get_pending_sap_sync_items(_table_name text, _company_id uuid, _limit int DEFAULT 100)
RETURNS SETOF json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT row_to_json(t) FROM (SELECT * FROM %I WHERE company_id = $1 AND sap_sync_status = ''pending'' ORDER BY created_at LIMIT $2) t',
    _table_name
  ) USING _company_id, _limit;
END;
$$;