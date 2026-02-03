

# System Security Hardening & SAP Compatibility Plan

## Executive Summary

The security scan identified **15 issues** (10 critical, 5 warnings) requiring attention. Additionally, I've assessed SAP integration readiness and identified several enhancements needed for full compatibility.

---

## Part 1: Security Findings

### Critical Issues (10)

| # | Issue | Table | Risk |
|---|-------|-------|------|
| 1 | Employee PII exposed | `profiles` | Any authenticated user can see all employee emails/names |
| 2 | Supplier data exposed | `suppliers` | Competitor could steal supplier relationships |
| 3 | Financial structure visible | `chart_of_accounts` | All employees see account balances |
| 4 | Customer data exposed | `customers` | Cross-company customer list leakage |
| 5 | Invoice amounts visible | `supplier_invoices` | Pricing info exposed |
| 6 | Bank account details exposed | `bank_accounts` | Account numbers visible to all |
| 7 | Bank transactions visible | `bank_transactions` | Cash flow patterns exposed |
| 8 | Supplier payments exposed | `supplier_payments` | Payment practices revealed |
| 9 | Salary data visible | `construction_labour_master` | Worker rates visible to all |
| 10 | Asset values exposed | `warehouse_assets` | Purchase prices visible |

### Warning Issues (5)

| # | Issue | Risk |
|---|-------|------|
| 1 | Purchase order policy conflicts | Inconsistent access control |
| 2 | Sensitive accounts may leak | Junior finance sees executive accounts |
| 3 | Contract confidentiality gaps | "Internal" contracts visible to all |
| 4 | Construction document policy redundancy | Potential access confusion |
| 5 | GRN status bypass possible | Items editable via parent status change |

---

## Part 2: SAP Compatibility Assessment

### Current State (Good)

| Component | Status |
|-----------|--------|
| `sap_entity_mappings` table | Implemented |
| `sap_sync_logs` audit table | Implemented |
| `sap_configurations` per company | Implemented |
| `invoice_number` field on invoices | Present |
| `po_number` field on POs | Present |
| Performance indexes | Created |
| RLS on SAP tables | Basic policies exist |

### Gaps Identified

| Gap | Description |
|-----|-------------|
| Missing `has_module_access()` function | For consistent module-level checks |
| SAP table access too permissive | Any company user can view SAP mappings |
| No `external_reference` field | For linking to SAP document numbers |
| Integration audit incomplete | Need operation-level logging for SAP syncs |

---

## Part 3: Implementation Plan

### Phase 1: Critical Security Hardening (RLS Policy Updates)

**Migration: Security lockdown for sensitive tables**

```sql
-- 1. PROFILES: Restrict to same company only
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view profiles in their company"
ON profiles FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND auth.uid() IS NOT NULL)
);

-- 2. SUPPLIERS: Restrict to procurement/finance roles
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Company users can view suppliers" ON suppliers;
CREATE POLICY "Authorized users can view suppliers"
ON suppliers FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_procurement_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);

-- 3. CUSTOMERS: Restrict to sales/finance roles
DROP POLICY IF EXISTS "Users can view customers in their company" ON customers;
CREATE POLICY "Authorized users can view customers"
ON customers FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_sales_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);

-- 4. CHART_OF_ACCOUNTS: Restrict with sensitivity check
DROP POLICY IF EXISTS "Users can view COA for their company" ON chart_of_accounts;
CREATE POLICY "Finance users can view COA"
ON chart_of_accounts FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()) AND
   (NOT is_sensitive OR has_senior_finance_access(auth.uid())))
);

-- 5. BANK_ACCOUNTS: Finance only
DROP POLICY IF EXISTS "Finance personnel can view bank accounts" ON bank_accounts;
CREATE POLICY "Finance can view bank accounts"
ON bank_accounts FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- 6. BANK_TRANSACTIONS: Finance only
DROP POLICY IF EXISTS "Finance users can view bank transactions" ON bank_transactions;
CREATE POLICY "Finance can view bank transactions"
ON bank_transactions FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- 7. SUPPLIER_PAYMENTS: Finance only
DROP POLICY IF EXISTS "Company users can view supplier payments" ON supplier_payments;
CREATE POLICY "Finance can view supplier payments"
ON supplier_payments FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- 8. CONSTRUCTION_LABOUR_MASTER: HR/managers only
DROP POLICY IF EXISTS "Authenticated users can view labour master for their company" ON construction_labour_master;
CREATE POLICY "HR and managers can view labour master"
ON construction_labour_master FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_hr_access(auth.uid()) OR 
    has_construction_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);

-- 9. WAREHOUSE_ASSETS: Warehouse/finance roles
DROP POLICY IF EXISTS "Authenticated users can view warehouse assets" ON warehouse_assets;
CREATE POLICY "Authorized users can view warehouse assets"
ON warehouse_assets FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_warehouse_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);

-- 10. SUPPLIER_INVOICES: Consolidate policies
DROP POLICY IF EXISTS "Company users can view invoices" ON supplier_invoices;
DROP POLICY IF EXISTS "Authenticated users can view supplier invoices" ON supplier_invoices;
CREATE POLICY "Finance and procurement can view supplier invoices"
ON supplier_invoices FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR has_procurement_access(auth.uid())))
);
```

### Phase 2: SAP Compatibility Enhancements

**Migration: Add SAP integration fields and functions**

```sql
-- 1. Add has_module_access function for consistent module checks
CREATE OR REPLACE FUNCTION has_module_access(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    is_admin(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM user_modules um
      WHERE um.user_id = _user_id 
      AND um.module_key = _module_key 
      AND um.access_type = 'grant'
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_modules rm ON ur.role_id = rm.role_id
        WHERE ur.user_id = _user_id AND rm.module_key = _module_key
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_modules um
        WHERE um.user_id = _user_id 
        AND um.module_key = _module_key 
        AND um.access_type = 'deny'
      )
    );
$$;

-- 2. Add SAP document reference fields to key tables
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS sap_document_number text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sap_last_sync_at timestamptz;

ALTER TABLE supplier_invoices 
ADD COLUMN IF NOT EXISTS sap_document_number text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sap_last_sync_at timestamptz;

ALTER TABLE customer_invoices 
ADD COLUMN IF NOT EXISTS sap_document_number text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sap_last_sync_at timestamptz;

ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS sap_vendor_code text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending';

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS sap_customer_code text,
ADD COLUMN IF NOT EXISTS sap_sync_status text DEFAULT 'pending';

-- 3. Create indexes for SAP sync queries
CREATE INDEX IF NOT EXISTS idx_po_sap_sync ON purchase_orders(sap_sync_status) 
WHERE sap_sync_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_si_sap_sync ON supplier_invoices(sap_sync_status) 
WHERE sap_sync_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ci_sap_sync ON customer_invoices(sap_sync_status) 
WHERE sap_sync_status = 'pending';

-- 4. Tighten SAP table RLS policies
DROP POLICY IF EXISTS "Company users can view SAP mappings" ON sap_entity_mappings;
CREATE POLICY "Finance and admin can view SAP mappings"
ON sap_entity_mappings FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR has_module_access(auth.uid(), 'sap-integration')))
);

DROP POLICY IF EXISTS "Company users can view sync logs" ON sap_sync_logs;
CREATE POLICY "Finance and admin can view sync logs"
ON sap_sync_logs FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR has_module_access(auth.uid(), 'sap-integration')))
);
```

### Phase 3: RBAC Constants Update

**File: `src/constants/rbacConfig.ts`**

```typescript
// Add SAP module and operations
export const SAP_MODULE_KEY = 'sap-integration';

export const SAP_OPERATIONS = ['view', 'sync', 'configure', 'audit'] as const;

export type SAPOperation = typeof SAP_OPERATIONS[number];

export const DEPARTMENT_MODULE_MAPPING = {
  Finance: ['finance', 'sap-integration'],
  Procurement: ['procurement', 'sourcing'],
  Warehouse: ['warehouse'],
  Construction: ['construction'],
  HR: ['training', 'hr'],
  IT: ['administration', 'sap-integration'],
  Sales: ['tuh-modules', 'sales'],
  Management: ['management'],
} as const;
```

### Phase 4: Warning Issue Fixes

**Migration: Address warning-level issues**

```sql
-- 1. Consolidate purchase_orders policies
DROP POLICY IF EXISTS "Company users can view POs" ON purchase_orders;
DROP POLICY IF EXISTS "Users can view POs in their company" ON purchase_orders;
CREATE POLICY "Authorized users can view purchase orders"
ON purchase_orders FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_procurement_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_warehouse_access(auth.uid()) OR
    has_manager_access(auth.uid()) OR
    created_by = auth.uid()))
);

-- 2. Protect GRN status changes
CREATE POLICY "Only admins can revert GRN status"
ON goods_receipt_notes FOR UPDATE
USING (
  CASE 
    WHEN status = 'draft' THEN can_access_company(company_id)
    ELSE is_admin(auth.uid())
  END
);

-- 3. Tighten contract confidentiality
DROP POLICY IF EXISTS "Company users can view internal contracts" ON contracts;
CREATE POLICY "Role-based contract access"
ON contracts FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   CASE confidentiality_level
     WHEN 'public' THEN true
     WHEN 'internal' THEN has_manager_access(auth.uid()) OR has_finance_access(auth.uid())
     WHEN 'confidential' THEN is_admin(auth.uid())
     WHEN 'strictly_confidential' THEN is_super_admin(auth.uid())
     ELSE false
   END)
);
```

---

## Part 4: Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/[ts]_security_hardening.sql` | Create | Critical RLS policy updates |
| `supabase/migrations/[ts]_sap_compatibility.sql` | Create | SAP fields and indexes |
| `supabase/migrations/[ts]_warning_fixes.sql` | Create | Warning-level fixes |
| `src/constants/rbacConfig.ts` | Modify | Add SAP module constants |
| `src/hooks/useRBAC.ts` | Modify | Add `hasSAPAccess()` helper |
| `src/types/moduleAccess.ts` | Modify | Add SAP operation types |

---

## Part 5: Security Checklist After Implementation

| Check | Status |
|-------|--------|
| Profiles restricted to same company | To implement |
| Suppliers restricted to procurement/finance | To implement |
| Customers restricted to sales/finance | To implement |
| Bank data restricted to finance | To implement |
| Salary data restricted to HR/managers | To implement |
| Asset values restricted to authorized roles | To implement |
| SAP tables restricted to finance/IT | To implement |
| Chart of accounts with sensitivity filtering | To implement |
| Purchase orders policies consolidated | To implement |
| GRN status change protection | To implement |
| Contract confidentiality enforced | To implement |
| `has_module_access()` function created | To implement |
| SAP sync fields added to key tables | To implement |
| SAP performance indexes created | To implement |

---

## Part 6: SAP Integration Readiness Summary

After implementation, your system will support:

- **Master Data Sync**: Suppliers, customers with SAP vendor/customer codes
- **Transaction Sync**: POs and invoices with SAP document numbers
- **Audit Trail**: Complete sync logging via `sap_sync_logs`
- **Status Tracking**: `sap_sync_status` on all syncable entities
- **Performance**: Indexed queries for pending sync items
- **Security**: RBAC-controlled access to SAP integration features

