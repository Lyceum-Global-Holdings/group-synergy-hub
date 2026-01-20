-- SUPABASE PERFORMANCE OPTIMIZATION - CORE INDEXES

-- PHASE 1: Fix RLS Function Performance (CRITICAL)
CREATE OR REPLACE FUNCTION public.can_access_company(target_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_company_id UUID;
BEGIN
  SELECT company_id INTO user_company_id
  FROM profiles
  WHERE user_id = auth.uid();
  
  IF is_super_admin(auth.uid()) THEN
    RETURN TRUE;
  END IF;
  
  IF user_company_id = target_company_id THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- User roles indexes (critical for RLS)
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role_id);

-- Roles lookup indexes
CREATE INDEX IF NOT EXISTS idx_roles_app_role ON public.roles(app_role);
CREATE INDEX IF NOT EXISTS idx_roles_department ON public.roles(department);

-- PHASE 2: High-Volume Table Indexes
CREATE INDEX IF NOT EXISTS idx_stock_transactions_item ON public.stock_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_company ON public.stock_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON public.stock_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr_id ON public.pr_items(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_items_warehouse_item ON public.pr_items(warehouse_item_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON public.po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_warehouse_item ON public.po_items(warehouse_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_po_items_cpo_id ON public.customer_po_items(cpo_id);
CREATE INDEX IF NOT EXISTS idx_role_modules_role ON public.role_modules(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);

-- PHASE 3: Core Company Indexes
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON public.bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_company ON public.bank_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_po_approvals_po ON public.po_approvals(po_id);
CREATE INDEX IF NOT EXISTS idx_pr_approvals_pr ON public.pr_approvals(pr_id);
CREATE INDEX IF NOT EXISTS idx_customer_po_workflow_cpo ON public.customer_po_workflow_tracking(cpo_id);

-- PHASE 4: Composite Indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_assets_company_status ON public.warehouse_assets(company_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_status ON public.purchase_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_grn_company_status ON public.goods_receipt_notes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON public.bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_warehouse_item ON public.bom_items(warehouse_item_id);

-- PHASE 5: Batch & Warehouse Indexes
CREATE INDEX IF NOT EXISTS idx_item_batches_warehouse_item ON public.item_batches(warehouse_item_id);
CREATE INDEX IF NOT EXISTS idx_item_batches_company ON public.item_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_item_batches_status ON public.item_batches(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_company ON public.warehouse_items(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_code ON public.warehouse_items(item_code);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON public.grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_warehouse_item ON public.grn_items(warehouse_item_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_company ON public.supplier_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON public.journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id);

-- PHASE 6: Trigram Extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_roles_name_trgm ON public.roles USING gin (name gin_trgm_ops);