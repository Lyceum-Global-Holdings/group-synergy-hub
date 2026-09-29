-- Finance: automatic journals, posting invoices, recording payments and receipts.
--
-- 1. Each company names its posting accounts in GL Settings (accounts payable
--    and receivable control, purchases, sales, input and output tax, and a
--    fallback cash/bank account).
-- 2. Posting a supplier invoice writes its journal (Dr purchases or the line's
--    account, Dr input tax, Cr accounts payable) and marks it posted; posting a
--    customer invoice writes Dr receivables, Cr sales, Cr output tax. Amounts are
--    converted with the invoice's exchange rate.
-- 3. Recording a supplier payment or customer receipt allocates it to posted
--    invoices (part-paid / paid), writes the bank transaction, moves the bank
--    balance and writes the journal (Dr payables / Cr bank, or Dr bank / Cr
--    receivables), all in one step. Supplier invoices from a PO still can't be
--    paid until their three-way match is accepted.
-- 4. Voiding a posted journal takes it out of the account balances (they were
--    left stale). Journals written by these steps can't be voided directly.
--
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Posting accounts and links
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gl_settings
  ADD COLUMN IF NOT EXISTS ap_control_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ar_control_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchases_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS input_tax_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS output_tax_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;
ALTER TABLE public.customer_invoices
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;

-- A usable posting account: active, not a header, in the company.
CREATE OR REPLACE FUNCTION public.gl_account_check(p_company_id uuid, p_account_id uuid, p_what text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'Set the % account in Finance › GL Settings › Posting accounts', p_what;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chart_of_accounts
                  WHERE id = p_account_id AND company_id = p_company_id
                    AND COALESCE(is_active, true) AND NOT COALESCE(is_header, false)) THEN
    RAISE EXCEPTION 'The % account must be an active, non-header account of this company', p_what;
  END IF;
  RETURN p_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_post_finance(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.can_access_company(p_company_id)
     AND (public.is_admin(auth.uid()) OR public.has_finance_access(auth.uid()))
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. System journals
-- ─────────────────────────────────────────────────────────────────────────────
-- p_lines: [{account_id, debit, credit, description?, supplier_id?, customer_id?}]
-- Written as a draft and then posted, so the balance check and the account
-- balance update run as for any journal.
CREATE OR REPLACE FUNCTION public.post_system_journal(
  p_company_id uuid,
  p_date date,
  p_reference_type text,
  p_reference_id uuid,
  p_reference_number text,
  p_description text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_je uuid;
  v_dr numeric;
  v_cr numeric;
  v_line jsonb;
  v_n integer := 0;
BEGIN
  SELECT round(SUM(COALESCE((l->>'debit')::numeric, 0)), 2), round(SUM(COALESCE((l->>'credit')::numeric, 0)), 2)
    INTO v_dr, v_cr
    FROM jsonb_array_elements(p_lines) l;
  IF COALESCE(v_dr, 0) <= 0 OR v_dr <> v_cr THEN
    RAISE EXCEPTION 'The journal doesn''t balance (debits %, credits %)', v_dr, v_cr;
  END IF;

  INSERT INTO public.journal_entries (journal_date, journal_type, reference_type, reference_id, reference_number, description,
                                      status, fiscal_year, period_month, company_id, created_by)
  VALUES (p_date, 'system_generated', p_reference_type, p_reference_id, p_reference_number, p_description,
          'draft', EXTRACT(YEAR FROM p_date)::int, EXTRACT(MONTH FROM p_date)::int, p_company_id, auth.uid())
  RETURNING id INTO v_je;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF COALESCE((v_line->>'debit')::numeric, 0) = 0 AND COALESCE((v_line->>'credit')::numeric, 0) = 0 THEN CONTINUE; END IF;
    v_n := v_n + 1;
    INSERT INTO public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit_amount, credit_amount,
                                            supplier_id, customer_id)
    VALUES (v_je, v_n, (v_line->>'account_id')::uuid, COALESCE(v_line->>'description', p_description),
            round(COALESCE((v_line->>'debit')::numeric, 0), 2), round(COALESCE((v_line->>'credit')::numeric, 0), 2),
            NULLIF(v_line->>'supplier_id', '')::uuid, NULLIF(v_line->>'customer_id', '')::uuid);
  END LOOP;

  UPDATE public.journal_entries
     SET status = 'posted', posted_by = auth.uid(), posted_date = now()
   WHERE id = v_je;
  RETURN v_je;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Posting invoices
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_supplier_invoice(p_invoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv public.supplier_invoices%ROWTYPE;
  s public.gl_settings%ROWTYPE;
  v_fx numeric;
  v_net numeric;
  v_tax numeric;
  v_lines jsonb := '[]'::jsonb;
  v_je uuid;
  l record;
BEGIN
  SELECT * INTO inv FROM public.supplier_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_post_finance(inv.company_id) THEN
    RAISE EXCEPTION 'Only finance users of this company can post supplier invoices' USING ERRCODE = '42501';
  END IF;
  IF inv.status NOT IN ('draft', 'pending_approval', 'approved') THEN
    RAISE EXCEPTION 'This invoice is %, so it can''t be posted', replace(inv.status, '_', ' ');
  END IF;
  SELECT * INTO s FROM public.gl_settings WHERE company_id = inv.company_id;

  v_fx := COALESCE(NULLIF(inv.exchange_rate, 0), 1);
  v_net := COALESCE((SELECT SUM(amount) FROM public.supplier_invoice_lines WHERE invoice_id = inv.id), inv.net_amount, 0);
  v_tax := COALESCE(inv.tax_amount, 0);
  IF abs(v_net + v_tax - COALESCE(inv.gross_amount, 0)) > 0.01 THEN
    RAISE EXCEPTION 'The invoice total (%) isn''t its lines (%) plus tax (%); correct it before posting', inv.gross_amount, v_net, v_tax;
  END IF;
  IF COALESCE(inv.gross_amount, 0) <= 0 THEN RAISE EXCEPTION 'The invoice has no amount to post'; END IF;

  IF EXISTS (SELECT 1 FROM public.supplier_invoice_lines WHERE invoice_id = inv.id) THEN
    FOR l IN SELECT * FROM public.supplier_invoice_lines WHERE invoice_id = inv.id ORDER BY line_number LOOP
      v_lines := v_lines || jsonb_build_object(
        'account_id', public.gl_account_check(inv.company_id, COALESCE(l.gl_account_id, inv.gl_account_id, s.purchases_account_id), 'purchases'),
        'debit', l.amount * v_fx, 'description', COALESCE(l.description, inv.invoice_number), 'supplier_id', inv.supplier_id);
    END LOOP;
  ELSE
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.gl_account_check(inv.company_id, COALESCE(inv.gl_account_id, s.purchases_account_id), 'purchases'),
      'debit', v_net * v_fx, 'supplier_id', inv.supplier_id);
  END IF;
  IF v_tax > 0 THEN
    v_lines := v_lines || jsonb_build_object('account_id', public.gl_account_check(inv.company_id, s.input_tax_account_id, 'input tax'),
                                             'debit', v_tax * v_fx, 'description', 'Input tax');
  END IF;
  v_lines := v_lines || jsonb_build_object('account_id', public.gl_account_check(inv.company_id, s.ap_control_account_id, 'accounts payable'),
                                           'credit', inv.gross_amount * v_fx, 'supplier_id', inv.supplier_id);

  v_je := public.post_system_journal(inv.company_id, inv.invoice_date, 'supplier_invoice', inv.id, inv.invoice_number,
                                     'Supplier invoice ' || inv.invoice_number, v_lines);
  UPDATE public.supplier_invoices
     SET status = 'posted', posted_by = auth.uid(), posted_date = now(), journal_entry_id = v_je, updated_at = now()
   WHERE id = inv.id;
  RETURN v_je;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_customer_invoice(p_invoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv public.customer_invoices%ROWTYPE;
  s public.gl_settings%ROWTYPE;
  v_tax numeric;
  v_total numeric;
  v_pre numeric;
  v_lines jsonb := '[]'::jsonb;
  v_je uuid;
BEGIN
  SELECT * INTO inv FROM public.customer_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_post_finance(inv.company_id) THEN
    RAISE EXCEPTION 'Only finance users of this company can post customer invoices' USING ERRCODE = '42501';
  END IF;
  IF inv.status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'This invoice is %, so it can''t be posted', replace(inv.status, '_', ' ');
  END IF;
  SELECT * INTO s FROM public.gl_settings WHERE company_id = inv.company_id;

  -- The screens store gross/net two ways; the total including tax is the larger.
  v_tax := COALESCE(inv.tax_amount, 0);
  v_total := GREATEST(COALESCE(inv.gross_amount, 0), COALESCE(inv.net_amount, 0));
  v_pre := v_total - v_tax;
  IF v_total <= 0 OR v_pre < 0 THEN RAISE EXCEPTION 'The invoice has no amount to post'; END IF;

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', public.gl_account_check(inv.company_id, s.ar_control_account_id, 'accounts receivable'),
                       'debit', v_total, 'customer_id', inv.customer_id),
    jsonb_build_object('account_id', public.gl_account_check(inv.company_id, COALESCE(inv.gl_account_id, s.sales_account_id), 'sales'),
                       'credit', v_pre, 'customer_id', inv.customer_id));
  IF v_tax > 0 THEN
    v_lines := v_lines || jsonb_build_object('account_id', public.gl_account_check(inv.company_id, s.output_tax_account_id, 'output tax'),
                                             'credit', v_tax, 'description', 'Output tax');
  END IF;

  v_je := public.post_system_journal(inv.company_id, inv.invoice_date, 'customer_invoice', inv.id, inv.invoice_number,
                                     'Customer invoice ' || inv.invoice_number, v_lines);
  -- From here on gross = total including tax, net = before tax (what ageing uses).
  UPDATE public.customer_invoices
     SET status = 'posted', posted_by = auth.uid(), posted_date = now(), journal_entry_id = v_je,
         gross_amount = v_total, net_amount = v_pre, updated_at = now()
   WHERE id = inv.id;
  RETURN v_je;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Payments and receipts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bank_gl_account(p_company_id uuid, p_bank_account_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v uuid;
BEGIN
  SELECT gl_account_id INTO v FROM public.bank_accounts
   WHERE id = p_bank_account_id AND company_id = p_company_id AND COALESCE(is_active, true);
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active bank account of this company'; END IF;
  RETURN public.gl_account_check(p_company_id, COALESCE(v, (SELECT cash_account_id FROM public.gl_settings WHERE company_id = p_company_id)),
                                 'bank (link the bank account to a GL account, or set the cash account)');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_document_number(p_prefix text, p_table text, p_column text, p_company_id uuid, p_date date)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_base text := p_prefix || '-' || to_char(p_date, 'YYYYMMDD') || '-';
  v_n integer;
  v_exists boolean;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I WHERE %I LIKE $1 AND company_id IS NOT DISTINCT FROM $2', p_table, p_column)
    INTO v_n USING v_base || '%', p_company_id;
  LOOP
    v_n := v_n + 1;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1)', p_table, p_column) INTO v_exists USING v_base || lpad(v_n::text, 3, '0');
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_base || lpad(v_n::text, 3, '0');
END;
$$;

-- p_allocations: [{invoice_id, amount}]; any rest is an unallocated advance.
CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_company_id uuid,
  p_supplier_id uuid,
  p_bank_account_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL,
  p_allocations jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bank_gl uuid;
  v_ap uuid;
  v_pay uuid;
  v_number text;
  a jsonb;
  inv public.supplier_invoices%ROWTYPE;
  v_amt numeric;
  v_total_alloc numeric := 0;
  v_je uuid;
BEGIN
  IF NOT public.can_post_finance(p_company_id) THEN
    RAISE EXCEPTION 'Only finance users of this company can record payments' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero'; END IF;
  IF p_method NOT IN ('check', 'wire', 'ach', 'cash', 'online') THEN RAISE EXCEPTION 'Unknown payment method %', p_method; END IF;
  IF p_payment_date IS NULL OR p_payment_date > CURRENT_DATE THEN RAISE EXCEPTION 'The payment date can''t be in the future'; END IF;
  v_bank_gl := public.bank_gl_account(p_company_id, p_bank_account_id);
  v_ap := public.gl_account_check(p_company_id, (SELECT ap_control_account_id FROM public.gl_settings WHERE company_id = p_company_id), 'accounts payable');

  v_number := public.next_document_number('PAY', 'supplier_payments', 'payment_number', p_company_id, p_payment_date);
  INSERT INTO public.supplier_payments (payment_number, supplier_id, payment_date, payment_method, total_amount, bank_account_id,
                                        reference_number, notes, status, company_id, created_by)
  VALUES (v_number, p_supplier_id, p_payment_date, p_method, p_amount, p_bank_account_id,
          NULLIF(btrim(COALESCE(p_reference, '')), ''), NULLIF(btrim(COALESCE(p_notes, '')), ''), 'posted', p_company_id, auth.uid())
  RETURNING id INTO v_pay;

  FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) LOOP
    v_amt := round(COALESCE(NULLIF(a->>'amount', '')::numeric, 0), 2);
    IF v_amt <= 0 THEN CONTINUE; END IF;
    SELECT * INTO inv FROM public.supplier_invoices WHERE id = (a->>'invoice_id')::uuid FOR UPDATE;
    IF NOT FOUND OR inv.company_id <> p_company_id OR inv.supplier_id <> p_supplier_id THEN
      RAISE EXCEPTION 'That invoice isn''t this supplier''s';
    END IF;
    IF inv.status NOT IN ('posted', 'partially_paid') THEN
      RAISE EXCEPTION 'Invoice % is %; only posted invoices can be paid', inv.invoice_number, replace(inv.status, '_', ' ');
    END IF;
    IF v_amt > inv.gross_amount - COALESCE(inv.amount_paid, 0) + 0.005 THEN
      RAISE EXCEPTION 'Only % is outstanding on invoice %', inv.gross_amount - COALESCE(inv.amount_paid, 0), inv.invoice_number;
    END IF;
    INSERT INTO public.payment_allocations (payment_id, invoice_id, amount_allocated) VALUES (v_pay, inv.id, v_amt);
    UPDATE public.supplier_invoices
       SET amount_paid = COALESCE(amount_paid, 0) + v_amt,
           status = CASE WHEN COALESCE(amount_paid, 0) + v_amt >= gross_amount - 0.005 THEN 'paid' ELSE 'partially_paid' END,
           updated_at = now()
     WHERE id = inv.id;
    v_total_alloc := v_total_alloc + v_amt;
  END LOOP;
  IF v_total_alloc > p_amount + 0.005 THEN
    RAISE EXCEPTION 'The allocations (%) are more than the payment (%)', v_total_alloc, p_amount;
  END IF;

  v_je := public.post_system_journal(p_company_id, p_payment_date, 'supplier_payment', v_pay, v_number, 'Supplier payment ' || v_number,
    jsonb_build_array(jsonb_build_object('account_id', v_ap, 'debit', p_amount, 'supplier_id', p_supplier_id),
                      jsonb_build_object('account_id', v_bank_gl, 'credit', p_amount, 'supplier_id', p_supplier_id)));
  UPDATE public.supplier_payments SET journal_entry_id = v_je WHERE id = v_pay;

  INSERT INTO public.bank_transactions (bank_account_id, transaction_date, transaction_type, debit_amount, credit_amount,
                                        reference_number, description, journal_entry_id, source_type, source_id, company_id, created_by)
  VALUES (p_bank_account_id, p_payment_date, 'payment', p_amount, 0, v_number, 'Supplier payment ' || v_number, v_je,
          'supplier_payment', v_pay, p_company_id, auth.uid());
  UPDATE public.bank_accounts SET current_balance = COALESCE(current_balance, 0) - p_amount, updated_at = now() WHERE id = p_bank_account_id;
  RETURN v_pay;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_customer_receipt(
  p_company_id uuid,
  p_customer_id uuid,
  p_bank_account_id uuid,
  p_receipt_date date,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL,
  p_allocations jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bank_gl uuid;
  v_ar uuid;
  v_rec uuid;
  v_number text;
  a jsonb;
  inv public.customer_invoices%ROWTYPE;
  v_amt numeric;
  v_total_alloc numeric := 0;
  v_je uuid;
BEGIN
  IF NOT public.can_post_finance(p_company_id) THEN
    RAISE EXCEPTION 'Only finance users of this company can record receipts' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero'; END IF;
  IF p_method NOT IN ('check', 'wire', 'ach', 'cash', 'online', 'card') THEN RAISE EXCEPTION 'Unknown payment method %', p_method; END IF;
  IF p_receipt_date IS NULL OR p_receipt_date > CURRENT_DATE THEN RAISE EXCEPTION 'The receipt date can''t be in the future'; END IF;
  v_bank_gl := public.bank_gl_account(p_company_id, p_bank_account_id);
  v_ar := public.gl_account_check(p_company_id, (SELECT ar_control_account_id FROM public.gl_settings WHERE company_id = p_company_id), 'accounts receivable');

  v_number := public.next_document_number('RCT', 'customer_receipts', 'receipt_number', p_company_id, p_receipt_date);
  INSERT INTO public.customer_receipts (receipt_number, customer_id, receipt_date, payment_method, total_amount, bank_account_id,
                                        reference_number, notes, status, company_id, created_by)
  VALUES (v_number, p_customer_id, p_receipt_date, p_method, p_amount, p_bank_account_id,
          NULLIF(btrim(COALESCE(p_reference, '')), ''), NULLIF(btrim(COALESCE(p_notes, '')), ''), 'posted', p_company_id, auth.uid())
  RETURNING id INTO v_rec;

  FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) LOOP
    v_amt := round(COALESCE(NULLIF(a->>'amount', '')::numeric, 0), 2);
    IF v_amt <= 0 THEN CONTINUE; END IF;
    SELECT * INTO inv FROM public.customer_invoices WHERE id = (a->>'invoice_id')::uuid FOR UPDATE;
    IF NOT FOUND OR inv.company_id <> p_company_id OR inv.customer_id <> p_customer_id THEN
      RAISE EXCEPTION 'That invoice isn''t this customer''s';
    END IF;
    IF inv.status NOT IN ('posted', 'partially_paid') THEN
      RAISE EXCEPTION 'Invoice % is %; only posted invoices can be paid', inv.invoice_number, replace(inv.status, '_', ' ');
    END IF;
    IF v_amt > inv.gross_amount - COALESCE(inv.amount_received, 0) + 0.005 THEN
      RAISE EXCEPTION 'Only % is outstanding on invoice %', inv.gross_amount - COALESCE(inv.amount_received, 0), inv.invoice_number;
    END IF;
    INSERT INTO public.receipt_allocations (receipt_id, invoice_id, amount_allocated) VALUES (v_rec, inv.id, v_amt);
    UPDATE public.customer_invoices
       SET amount_received = COALESCE(amount_received, 0) + v_amt,
           status = CASE WHEN COALESCE(amount_received, 0) + v_amt >= gross_amount - 0.005 THEN 'paid' ELSE 'partially_paid' END,
           updated_at = now()
     WHERE id = inv.id;
    v_total_alloc := v_total_alloc + v_amt;
  END LOOP;
  IF v_total_alloc > p_amount + 0.005 THEN
    RAISE EXCEPTION 'The allocations (%) are more than the receipt (%)', v_total_alloc, p_amount;
  END IF;

  v_je := public.post_system_journal(p_company_id, p_receipt_date, 'customer_receipt', v_rec, v_number, 'Customer receipt ' || v_number,
    jsonb_build_array(jsonb_build_object('account_id', v_bank_gl, 'debit', p_amount, 'customer_id', p_customer_id),
                      jsonb_build_object('account_id', v_ar, 'credit', p_amount, 'customer_id', p_customer_id)));
  UPDATE public.customer_receipts SET journal_entry_id = v_je WHERE id = v_rec;

  INSERT INTO public.bank_transactions (bank_account_id, transaction_date, transaction_type, debit_amount, credit_amount,
                                        reference_number, description, journal_entry_id, source_type, source_id, company_id, created_by)
  VALUES (p_bank_account_id, p_receipt_date, 'receipt', 0, p_amount, v_number, 'Customer receipt ' || v_number, v_je,
          'customer_receipt', v_rec, p_company_id, auth.uid());
  UPDATE public.bank_accounts SET current_balance = COALESCE(current_balance, 0) + p_amount, updated_at = now() WHERE id = p_bank_account_id;
  RETURN v_rec;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Voiding a posted journal
-- ─────────────────────────────────────────────────────────────────────────────
-- Balances are recalculated from posted lines, so a journal leaving "posted"
-- must recalculate them too (the existing trigger only ran on posting).
DROP TRIGGER IF EXISTS trigger_update_account_balances_on_unpost ON public.journal_entries;
CREATE TRIGGER trigger_update_account_balances_on_unpost
  AFTER UPDATE OF status ON public.journal_entries
  FOR EACH ROW
  WHEN (OLD.status = 'posted' AND NEW.status IN ('void', 'reversed'))
  EXECUTE FUNCTION public.update_account_balances_on_post();

CREATE OR REPLACE FUNCTION public.guard_system_journal_void()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND OLD.status = 'posted' AND NEW.status IN ('void', 'reversed', 'draft')
     AND OLD.reference_type IN ('supplier_invoice', 'customer_invoice', 'supplier_payment', 'customer_receipt') THEN
    RAISE EXCEPTION 'This journal belongs to a posted invoice or payment and can''t be voided on its own' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_system_journal_void ON public.journal_entries;
CREATE TRIGGER trg_guard_system_journal_void
  BEFORE UPDATE OF status ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.guard_system_journal_void();

-- Bring balances in line for journals already voided.
UPDATE public.chart_of_accounts coa
   SET current_balance = COALESCE(coa.opening_balance, 0) + COALESCE((
         SELECT SUM(CASE WHEN coa.normal_balance = 'debit' THEN jel.debit_amount - jel.credit_amount
                         ELSE jel.credit_amount - jel.debit_amount END)
           FROM public.journal_entry_lines jel
           JOIN public.journal_entries je ON je.id = jel.journal_entry_id
          WHERE jel.account_id = coa.id AND je.status = 'posted'), 0),
       updated_at = now()
 WHERE coa.id IN (SELECT jel.account_id FROM public.journal_entry_lines jel
                    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
                   WHERE je.status IN ('void', 'reversed'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.post_supplier_invoice(uuid)',
    'public.post_customer_invoice(uuid)',
    'public.record_supplier_payment(uuid, uuid, uuid, date, numeric, text, text, jsonb, text)',
    'public.record_customer_receipt(uuid, uuid, uuid, date, numeric, text, text, jsonb, text)',
    'public.can_post_finance(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.post_system_journal(uuid, date, text, uuid, text, text, jsonb)',
    'public.gl_account_check(uuid, uuid, text)',
    'public.bank_gl_account(uuid, uuid)',
    'public.next_document_number(text, text, text, uuid, date)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN ('post_supplier_invoice', 'post_customer_invoice',
--        'record_supplier_payment', 'record_customer_receipt', 'post_system_journal')) AS functions,  -- 5
--     (SELECT count(*) FROM information_schema.columns WHERE table_name = 'gl_settings'
--        AND column_name LIKE '%_account_id') AS posting_account_columns,  -- 7
--     (SELECT count(*) FROM public.gl_settings WHERE ap_control_account_id IS NOT NULL) AS companies_ready_to_post;  -- 0 until set
-- ─────────────────────────────────────────────────────────────────────────────
