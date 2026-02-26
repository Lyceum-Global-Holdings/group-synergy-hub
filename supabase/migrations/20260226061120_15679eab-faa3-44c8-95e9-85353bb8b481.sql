
-- ============================================================
-- Fix missing SELECT/INSERT/UPDATE RLS policies on 11 finance tables
-- that previously had USING(true) which was dropped but never replaced
-- ============================================================

-- 1. supplier_invoice_lines (child of supplier_invoices via invoice_id)
CREATE POLICY "Finance can view supplier invoice lines"
ON public.supplier_invoice_lines FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = supplier_invoice_lines.invoice_id
    AND (is_admin(auth.uid()) OR (can_access_company(si.company_id) AND (has_finance_access(auth.uid()) OR has_procurement_access(auth.uid()))))
  )
);

CREATE POLICY "Finance can insert supplier invoice lines"
ON public.supplier_invoice_lines FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = supplier_invoice_lines.invoice_id
    AND (is_admin(auth.uid()) OR (can_access_company(si.company_id) AND has_finance_access(auth.uid())))
  )
);

CREATE POLICY "Finance can update supplier invoice lines"
ON public.supplier_invoice_lines FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = supplier_invoice_lines.invoice_id
    AND (is_admin(auth.uid()) OR (can_access_company(si.company_id) AND has_finance_access(auth.uid())))
  )
);

-- 2. payment_allocations (child of supplier_payments via payment_id)
CREATE POLICY "Finance can view payment allocations"
ON public.payment_allocations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM supplier_payments sp
    WHERE sp.id = payment_allocations.payment_id
    AND (is_admin(auth.uid()) OR (can_access_company(sp.company_id) AND has_finance_access(auth.uid())))
  )
);

CREATE POLICY "Finance can insert payment allocations"
ON public.payment_allocations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM supplier_payments sp
    WHERE sp.id = payment_allocations.payment_id
    AND (is_admin(auth.uid()) OR (can_access_company(sp.company_id) AND has_finance_access(auth.uid())))
  )
);

CREATE POLICY "Finance can update payment allocations"
ON public.payment_allocations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM supplier_payments sp
    WHERE sp.id = payment_allocations.payment_id
    AND (is_admin(auth.uid()) OR (can_access_company(sp.company_id) AND has_finance_access(auth.uid())))
  )
);

-- 3. customer_invoice_lines (child of customer_invoices via invoice_id)
CREATE POLICY "Finance can view customer invoice lines"
ON public.customer_invoice_lines FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_invoices ci
    WHERE ci.id = customer_invoice_lines.invoice_id
    AND (is_admin(auth.uid()) OR (can_access_company(ci.company_id) AND (has_senior_finance_access(auth.uid()) OR has_sales_access(auth.uid()))))
  )
);

CREATE POLICY "Finance can insert customer invoice lines"
ON public.customer_invoice_lines FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_invoices ci
    WHERE ci.id = customer_invoice_lines.invoice_id
    AND (is_admin(auth.uid()) OR (can_access_company(ci.company_id) AND has_senior_finance_access(auth.uid())))
  )
);

CREATE POLICY "Finance can update customer invoice lines"
ON public.customer_invoice_lines FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_invoices ci
    WHERE ci.id = customer_invoice_lines.invoice_id
    AND (is_admin(auth.uid()) OR (can_access_company(ci.company_id) AND has_senior_finance_access(auth.uid())))
  )
);

-- 4. customer_receipts (has company_id)
CREATE POLICY "Finance can view customer receipts"
ON public.customer_receipts FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND (has_senior_finance_access(auth.uid()) OR has_sales_access(auth.uid())))
);

CREATE POLICY "Finance can insert customer receipts"
ON public.customer_receipts FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_senior_finance_access(auth.uid()))
);

CREATE POLICY "Finance can update customer receipts"
ON public.customer_receipts FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_senior_finance_access(auth.uid()))
);

-- 5. receipt_allocations (child of customer_receipts via receipt_id)
CREATE POLICY "Finance can view receipt allocations"
ON public.receipt_allocations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_receipts cr
    WHERE cr.id = receipt_allocations.receipt_id
    AND (is_admin(auth.uid()) OR (can_access_company(cr.company_id) AND has_senior_finance_access(auth.uid())))
  )
);

CREATE POLICY "Finance can insert receipt allocations"
ON public.receipt_allocations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_receipts cr
    WHERE cr.id = receipt_allocations.receipt_id
    AND (is_admin(auth.uid()) OR (can_access_company(cr.company_id) AND has_senior_finance_access(auth.uid())))
  )
);

CREATE POLICY "Finance can update receipt allocations"
ON public.receipt_allocations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_receipts cr
    WHERE cr.id = receipt_allocations.receipt_id
    AND (is_admin(auth.uid()) OR (can_access_company(cr.company_id) AND has_senior_finance_access(auth.uid())))
  )
);

-- 6. bank_statements (has company_id)
CREATE POLICY "Finance can view bank statements"
ON public.bank_statements FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

CREATE POLICY "Finance can insert bank statements"
ON public.bank_statements FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

CREATE POLICY "Finance can update bank statements"
ON public.bank_statements FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- 7. bank_reconciliations (has company_id)
CREATE POLICY "Finance can view bank reconciliations"
ON public.bank_reconciliations FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

CREATE POLICY "Finance can insert bank reconciliations"
ON public.bank_reconciliations FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

CREATE POLICY "Finance can update bank reconciliations"
ON public.bank_reconciliations FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- 8. asset_transactions (has company_id)
CREATE POLICY "Finance can view asset transactions"
ON public.asset_transactions FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

CREATE POLICY "Finance can insert asset transactions"
ON public.asset_transactions FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

CREATE POLICY "Finance can update asset transactions"
ON public.asset_transactions FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- 9. depreciation_schedule (has company_id)
CREATE POLICY "Finance can view depreciation schedule"
ON public.depreciation_schedule FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

CREATE POLICY "Finance can insert depreciation schedule"
ON public.depreciation_schedule FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

CREATE POLICY "Finance can update depreciation schedule"
ON public.depreciation_schedule FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- 10. profit_centers (has company_id)
CREATE POLICY "Finance can view profit centers"
ON public.profit_centers FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND (has_finance_access(auth.uid()) OR has_manager_access(auth.uid())))
);

CREATE POLICY "Finance can insert profit centers"
ON public.profit_centers FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

CREATE POLICY "Finance can update profit centers"
ON public.profit_centers FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid()) OR (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- 11. budget_lines (child of budgets via budget_id)
CREATE POLICY "Finance can view budget lines"
ON public.budget_lines FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_lines.budget_id
    AND (is_admin(auth.uid()) OR (can_access_company(b.company_id) AND (has_finance_access(auth.uid()) OR has_manager_access(auth.uid()))))
  )
);

CREATE POLICY "Finance can insert budget lines"
ON public.budget_lines FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_lines.budget_id
    AND (is_admin(auth.uid()) OR (can_access_company(b.company_id) AND has_finance_access(auth.uid())))
  )
);

CREATE POLICY "Finance can update budget lines"
ON public.budget_lines FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_lines.budget_id
    AND (is_admin(auth.uid()) OR (can_access_company(b.company_id) AND has_finance_access(auth.uid())))
  )
);
