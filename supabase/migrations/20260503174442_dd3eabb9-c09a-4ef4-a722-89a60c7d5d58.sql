
-- =============================================================
-- 1. Construction tables: company-scoped RLS
-- =============================================================

-- construction_item_master
DROP POLICY IF EXISTS "item_master_select" ON public.construction_item_master;
DROP POLICY IF EXISTS "item_master_all" ON public.construction_item_master;

CREATE POLICY "item_master_select_company" ON public.construction_item_master
  FOR SELECT USING (can_access_company(company_id));
CREATE POLICY "item_master_insert_company" ON public.construction_item_master
  FOR INSERT WITH CHECK (can_access_company(company_id));
CREATE POLICY "item_master_update_company" ON public.construction_item_master
  FOR UPDATE USING (can_access_company(company_id)) WITH CHECK (can_access_company(company_id));
CREATE POLICY "item_master_delete_company" ON public.construction_item_master
  FOR DELETE USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- construction_serial_numbers
DROP POLICY IF EXISTS "serial_numbers_select" ON public.construction_serial_numbers;
DROP POLICY IF EXISTS "serial_numbers_all" ON public.construction_serial_numbers;

CREATE POLICY "serial_numbers_select_company" ON public.construction_serial_numbers
  FOR SELECT USING (can_access_company(company_id));
CREATE POLICY "serial_numbers_insert_company" ON public.construction_serial_numbers
  FOR INSERT WITH CHECK (can_access_company(company_id));
CREATE POLICY "serial_numbers_update_company" ON public.construction_serial_numbers
  FOR UPDATE USING (can_access_company(company_id)) WITH CHECK (can_access_company(company_id));
CREATE POLICY "serial_numbers_delete_company" ON public.construction_serial_numbers
  FOR DELETE USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- construction_inventory_transfers
DROP POLICY IF EXISTS "transfers_select" ON public.construction_inventory_transfers;
DROP POLICY IF EXISTS "transfers_all" ON public.construction_inventory_transfers;

CREATE POLICY "transfers_select_company" ON public.construction_inventory_transfers
  FOR SELECT USING (can_access_company(company_id));
CREATE POLICY "transfers_insert_company" ON public.construction_inventory_transfers
  FOR INSERT WITH CHECK (can_access_company(company_id));
CREATE POLICY "transfers_update_company" ON public.construction_inventory_transfers
  FOR UPDATE USING (can_access_company(company_id)) WITH CHECK (can_access_company(company_id));
CREATE POLICY "transfers_delete_company" ON public.construction_inventory_transfers
  FOR DELETE USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- construction_inventory_stock
DROP POLICY IF EXISTS "stock_select" ON public.construction_inventory_stock;
DROP POLICY IF EXISTS "stock_all" ON public.construction_inventory_stock;

CREATE POLICY "stock_select_company" ON public.construction_inventory_stock
  FOR SELECT USING (can_access_company(company_id));
CREATE POLICY "stock_insert_company" ON public.construction_inventory_stock
  FOR INSERT WITH CHECK (can_access_company(company_id));
CREATE POLICY "stock_update_company" ON public.construction_inventory_stock
  FOR UPDATE USING (can_access_company(company_id)) WITH CHECK (can_access_company(company_id));
CREATE POLICY "stock_delete_company" ON public.construction_inventory_stock
  FOR DELETE USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- construction_inventory_transactions
DROP POLICY IF EXISTS "transactions_select" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "transactions_all" ON public.construction_inventory_transactions;

CREATE POLICY "transactions_select_company" ON public.construction_inventory_transactions
  FOR SELECT USING (can_access_company(company_id));
CREATE POLICY "transactions_insert_company" ON public.construction_inventory_transactions
  FOR INSERT WITH CHECK (can_access_company(company_id));
CREATE POLICY "transactions_update_company" ON public.construction_inventory_transactions
  FOR UPDATE USING (can_access_company(company_id)) WITH CHECK (can_access_company(company_id));
CREATE POLICY "transactions_delete_company" ON public.construction_inventory_transactions
  FOR DELETE USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- construction_repair_records
DROP POLICY IF EXISTS "repairs_select" ON public.construction_repair_records;
DROP POLICY IF EXISTS "repairs_all" ON public.construction_repair_records;

CREATE POLICY "repairs_select_company" ON public.construction_repair_records
  FOR SELECT USING (can_access_company(company_id));
CREATE POLICY "repairs_insert_company" ON public.construction_repair_records
  FOR INSERT WITH CHECK (can_access_company(company_id));
CREATE POLICY "repairs_update_company" ON public.construction_repair_records
  FOR UPDATE USING (can_access_company(company_id)) WITH CHECK (can_access_company(company_id));
CREATE POLICY "repairs_delete_company" ON public.construction_repair_records
  FOR DELETE USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- construction_transfer_items (no company_id; derive from parent transfer)
DROP POLICY IF EXISTS "transfer_items_select" ON public.construction_transfer_items;
DROP POLICY IF EXISTS "transfer_items_all" ON public.construction_transfer_items;

CREATE POLICY "transfer_items_select_company" ON public.construction_transfer_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.construction_inventory_transfers t
      WHERE t.id = construction_transfer_items.transfer_id
        AND can_access_company(t.company_id)
    )
  );
CREATE POLICY "transfer_items_insert_company" ON public.construction_transfer_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.construction_inventory_transfers t
      WHERE t.id = construction_transfer_items.transfer_id
        AND can_access_company(t.company_id)
    )
  );
CREATE POLICY "transfer_items_update_company" ON public.construction_transfer_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.construction_inventory_transfers t
      WHERE t.id = construction_transfer_items.transfer_id
        AND can_access_company(t.company_id)
    )
  );
CREATE POLICY "transfer_items_delete_company" ON public.construction_transfer_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.construction_inventory_transfers t
      WHERE t.id = construction_transfer_items.transfer_id
        AND can_access_company(t.company_id) AND is_admin(auth.uid())
    )
  );

-- =============================================================
-- 2. construction_inventory_master: drop blanket SELECT
-- =============================================================
DROP POLICY IF EXISTS "Authenticated users can view inventory master" ON public.construction_inventory_master;

CREATE POLICY "Users can view inventory master in their companies" ON public.construction_inventory_master
  FOR SELECT USING (can_access_company(company_id));

-- =============================================================
-- 3. kpi_definitions: scope SELECT
-- =============================================================
DROP POLICY IF EXISTS "Users can view KPI definitions" ON public.kpi_definitions;

CREATE POLICY "Users can view accessible KPI definitions" ON public.kpi_definitions
  FOR SELECT USING (
    company_id IS NULL OR can_access_company(company_id)
  );

-- =============================================================
-- 4. Audit views: switch to SECURITY INVOKER
-- =============================================================
ALTER VIEW public.v_stock_transactions_location_mismatch SET (security_invoker = true);
ALTER VIEW public.v_stock_transactions_bin_mismatch SET (security_invoker = true);
ALTER VIEW public.v_stock_transactions_balance_drift SET (security_invoker = true);
