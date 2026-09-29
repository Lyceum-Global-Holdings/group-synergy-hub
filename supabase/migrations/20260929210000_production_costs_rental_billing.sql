-- Production cost lines for the whole order, and rental billing.
--
-- 1. Production: a BOM cost line on a production order stage is the BOM's
--    per-piece consumption (× the BOM size multiplier, as demand planning uses)
--    × the order's target quantity. They were copied for one piece, so issuing
--    materials and the stage cost reports covered a single garment. Existing
--    lines of open and completed orders are rescaled (never below what was
--    already issued).
-- 2. Rental: checking out a rental invoices the customer (draft customer invoice
--    with one line per costume, rental income account if set); a return with late
--    or damage fees invoices those too. Finance posts them as usual.
--    The deposit is recorded when collected (Dr bank, Cr customer deposits), and
--    settled after the return: it pays the rental's open invoices first and the
--    rest is refunded (Dr customer deposits, Cr receivables / bank). A rental
--    with a deposit still held can't be completed. Checking out needs a customer.
--
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Production stage cost lines
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.production_stage_costs
  ADD COLUMN IF NOT EXISTS per_unit_qty numeric(14,4);

-- Per-piece quantity of a BOM line: consumption (else quantity) × the size multiplier of the BOM's size.
CREATE OR REPLACE FUNCTION public.bom_item_per_unit_qty(p_bom_item_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(bi.consumption, 0), bi.quantity, 0)
       * COALESCE((SELECT m.multiplier FROM public.bom_size_multipliers m
                    WHERE m.bom_id = b.id AND m.size = b.size LIMIT 1), 1)
    FROM public.bom_items bi
    JOIN public.bill_of_materials b ON b.id = bi.bom_id
   WHERE bi.id = p_bom_item_id
$$;

CREATE OR REPLACE FUNCTION public.scale_bom_stage_cost()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_target numeric;
  v_cost numeric;
BEGIN
  IF NEW.source <> 'bom' OR NEW.bom_item_id IS NULL THEN RETURN NEW; END IF;
  SELECT o.target_qty INTO v_target
    FROM public.production_order_stages s JOIN public.production_orders o ON o.id = s.order_id
   WHERE s.id = NEW.stage_id;
  SELECT unit_cost INTO v_cost FROM public.bom_items WHERE id = NEW.bom_item_id;
  NEW.per_unit_qty := round(COALESCE(public.bom_item_per_unit_qty(NEW.bom_item_id), 0), 4);
  NEW.unit_cost := COALESCE(v_cost, NEW.unit_cost, 0);
  NEW.quantity_used := GREATEST(round(NEW.per_unit_qty * COALESCE(v_target, 0), 4), COALESCE(NEW.consumed_qty, 0));
  NEW.total_cost := round(NEW.quantity_used * NEW.unit_cost, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scale_bom_stage_cost ON public.production_stage_costs;
CREATE TRIGGER trg_scale_bom_stage_cost
  BEFORE INSERT ON public.production_stage_costs
  FOR EACH ROW EXECUTE FUNCTION public.scale_bom_stage_cost();

-- If an order's target quantity changes, its BOM lines follow (never below what was issued).
CREATE OR REPLACE FUNCTION public.rescale_order_bom_costs()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.production_stage_costs c
     SET quantity_used = GREATEST(round(c.per_unit_qty * NEW.target_qty, 4), c.consumed_qty),
         total_cost = round(GREATEST(round(c.per_unit_qty * NEW.target_qty, 4), c.consumed_qty) * COALESCE(c.unit_cost, 0), 2),
         updated_at = now()
    FROM public.production_order_stages s
   WHERE s.id = c.stage_id AND s.order_id = NEW.id AND c.source = 'bom' AND c.per_unit_qty IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rescale_order_bom_costs ON public.production_orders;
CREATE TRIGGER trg_rescale_order_bom_costs
  AFTER UPDATE OF target_qty ON public.production_orders
  FOR EACH ROW WHEN (OLD.target_qty IS DISTINCT FROM NEW.target_qty)
  EXECUTE FUNCTION public.rescale_order_bom_costs();

-- Rescale the lines already created for one piece.
UPDATE public.production_stage_costs c
   SET per_unit_qty = round(COALESCE(public.bom_item_per_unit_qty(c.bom_item_id), 0), 4),
       unit_cost = COALESCE(bi.unit_cost, c.unit_cost, 0),
       quantity_used = GREATEST(round(round(COALESCE(public.bom_item_per_unit_qty(c.bom_item_id), 0), 4) * o.target_qty, 4), c.consumed_qty),
       total_cost = round(GREATEST(round(round(COALESCE(public.bom_item_per_unit_qty(c.bom_item_id), 0), 4) * o.target_qty, 4), c.consumed_qty)
                          * COALESCE(bi.unit_cost, c.unit_cost, 0), 2),
       updated_at = now()
  FROM public.production_order_stages s
  JOIN public.production_orders o ON o.id = s.order_id
  JOIN public.bom_items bi ON TRUE
 WHERE s.id = c.stage_id AND bi.id = c.bom_item_id
   AND c.source = 'bom' AND c.per_unit_qty IS NULL AND o.status <> 'cancelled';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Rental billing: accounts, links, deposit ledger
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gl_settings
  ADD COLUMN IF NOT EXISTS customer_deposit_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rental_income_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.customer_invoices
  ADD COLUMN IF NOT EXISTS rental_order_id uuid REFERENCES public.rental_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customer_invoices_rental ON public.customer_invoices (rental_order_id) WHERE rental_order_id IS NOT NULL;

ALTER TABLE public.rental_orders
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS charges_invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deposit_received numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_applied numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_refunded numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_settled_at timestamptz;

CREATE TABLE IF NOT EXISTS public.rental_deposit_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_order_id uuid NOT NULL REFERENCES public.rental_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('received', 'applied', 'refunded')),
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  bank_account_id uuid,
  payment_method text,
  reference text,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_deposit_movements_order ON public.rental_deposit_movements (rental_order_id);
ALTER TABLE public.rental_deposit_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users can view rental deposit movements" ON public.rental_deposit_movements;
CREATE POLICY "Company users can view rental deposit movements" ON public.rental_deposit_movements
  FOR SELECT TO authenticated USING (public.can_access_company(company_id));

-- Status, fees, deposits and invoice links change only through the rental
-- functions (company users could update them directly). The customer can't
-- change once the rental has been invoiced.
CREATE OR REPLACE FUNCTION public.guard_rental_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status NOT IN ('draft', 'cancelled', 'rejected') THEN
      RAISE EXCEPTION 'Only a draft, rejected or cancelled rental can be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'New rentals start as drafts'; END IF;
    NEW.late_fee := 0; NEW.damage_fee := 0; NEW.deposit_refund := 0;
    NEW.deposit_received := 0; NEW.deposit_applied := 0; NEW.deposit_refunded := 0;
    NEW.invoice_id := NULL; NEW.charges_invoice_id := NULL; NEW.deposit_settled_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.late_fee IS DISTINCT FROM OLD.late_fee OR NEW.damage_fee IS DISTINCT FROM OLD.damage_fee
     OR NEW.deposit_refund IS DISTINCT FROM OLD.deposit_refund
     OR NEW.deposit_received IS DISTINCT FROM OLD.deposit_received OR NEW.deposit_applied IS DISTINCT FROM OLD.deposit_applied
     OR NEW.deposit_refunded IS DISTINCT FROM OLD.deposit_refunded OR NEW.deposit_settled_at IS DISTINCT FROM OLD.deposit_settled_at
     OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR NEW.charges_invoice_id IS DISTINCT FROM OLD.charges_invoice_id THEN
    RAISE EXCEPTION 'Use the rental''s actions to change its status, fees or deposit';
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id AND OLD.status IN ('checked_out', 'returned', 'completed') THEN
    RAISE EXCEPTION 'The rental has been invoiced, so its customer can''t change';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_rental_order ON public.rental_orders;
CREATE TRIGGER trg_guard_rental_order
  BEFORE INSERT OR UPDATE OR DELETE ON public.rental_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_rental_order();

-- A rental is invoiced to its customer, so checking out needs one.
CREATE OR REPLACE FUNCTION public.require_rental_customer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'checked_out' AND OLD.status IS DISTINCT FROM 'checked_out' AND NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'Choose the customer before checking out: the rental is invoiced to them';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_rental_customer ON public.rental_orders;
CREATE TRIGGER trg_require_rental_customer
  BEFORE UPDATE OF status ON public.rental_orders
  FOR EACH ROW EXECUTE FUNCTION public.require_rental_customer();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Invoices from rentals
-- ─────────────────────────────────────────────────────────────────────────────
-- Draft customer invoice for the rental (on check-out) or its return charges.
CREATE OR REPLACE FUNCTION public.create_rental_invoice(p_order_id uuid, p_kind text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  o public.rental_orders%ROWTYPE;
  v_inv uuid;
  v_gross numeric;
  v_tax numeric := 0;
  v_late_days integer;
  v_income uuid;
  v_n integer := 0;
  l record;
BEGIN
  SELECT * INTO o FROM public.rental_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rental not found'; END IF;
  SELECT rental_income_account_id INTO v_income FROM public.gl_settings WHERE company_id = o.company_id;

  IF p_kind = 'rental' THEN
    IF o.invoice_id IS NOT NULL THEN RETURN o.invoice_id; END IF;
    v_gross := round(COALESCE(o.rental_total, 0) - COALESCE(o.discount_amount, 0), 2);
    v_tax := round(COALESCE(o.tax_amount, 0), 2);
    IF v_gross + v_tax <= 0 THEN RETURN NULL; END IF;
  ELSE
    IF o.charges_invoice_id IS NOT NULL THEN RETURN o.charges_invoice_id; END IF;
    v_gross := round(COALESCE(o.late_fee, 0) + COALESCE(o.damage_fee, 0), 2);
    IF v_gross <= 0 THEN RETURN NULL; END IF;
  END IF;

  INSERT INTO public.customer_invoices (invoice_number, customer_id, invoice_date, due_date, gross_amount, tax_amount, net_amount,
                                        status, currency, gl_account_id, rental_order_id, notes, company_id, created_by)
  VALUES (public.generate_sales_invoice_number(), o.customer_id, CURRENT_DATE,
          CASE WHEN p_kind = 'rental' THEN GREATEST(COALESCE(o.due_date, CURRENT_DATE), CURRENT_DATE) ELSE CURRENT_DATE END,
          v_gross, v_tax, v_gross + v_tax, 'draft', 'LKR', v_income, o.id,
          CASE WHEN p_kind = 'rental' THEN 'Costume rental ' ELSE 'Return charges for rental ' END || o.rental_number,
          o.company_id, auth.uid())
  RETURNING id INTO v_inv;

  IF p_kind = 'rental' THEN
    FOR l IN SELECT i.*, c.name AS costume_name
               FROM public.rental_order_items i JOIN public.rental_costumes c ON c.id = i.costume_id
              WHERE i.rental_order_id = o.id ORDER BY i.created_at LOOP
      v_n := v_n + 1;
      INSERT INTO public.customer_invoice_items (invoice_id, item_name, description, unit, quantity, unit_price, line_total, sort_order)
      VALUES (v_inv, l.costume_name || CASE WHEN COALESCE(l.size, '') <> '' THEN ' (' || l.size || ')' ELSE '' END,
              l.rental_days || ' day(s), ' || to_char(o.pickup_date, 'DD Mon') || ' – ' || to_char(o.due_date, 'DD Mon YYYY'),
              'rental', l.quantity, round(COALESCE(l.line_total, 0) / NULLIF(l.quantity, 0), 2), COALESCE(l.line_total, 0), v_n);
    END LOOP;
    IF COALESCE(o.discount_amount, 0) > 0 THEN
      v_n := v_n + 1;
      INSERT INTO public.customer_invoice_items (invoice_id, item_name, unit, quantity, unit_price, line_total, sort_order)
      VALUES (v_inv, 'Discount', 'each', 1, -o.discount_amount, -o.discount_amount, v_n);
    END IF;
    UPDATE public.rental_orders SET invoice_id = v_inv WHERE id = o.id;
  ELSE
    v_late_days := GREATEST(0, COALESCE(o.actual_return_date, CURRENT_DATE) - o.due_date);
    IF COALESCE(o.late_fee, 0) > 0 THEN
      INSERT INTO public.customer_invoice_items (invoice_id, item_name, description, unit, quantity, unit_price, line_total, sort_order)
      VALUES (v_inv, 'Late return', v_late_days || ' day(s) late', 'each', 1, o.late_fee, o.late_fee, 1);
    END IF;
    IF COALESCE(o.damage_fee, 0) > 0 THEN
      INSERT INTO public.customer_invoice_items (invoice_id, item_name, unit, quantity, unit_price, line_total, sort_order)
      VALUES (v_inv, 'Damage', 'each', 1, o.damage_fee, o.damage_fee, 2);
    END IF;
    UPDATE public.rental_orders SET charges_invoice_id = v_inv WHERE id = o.id;
  END IF;
  RETURN v_inv;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_rental_on_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'checked_out' THEN
    PERFORM public.create_rental_invoice(NEW.id, 'rental');
  ELSIF NEW.status = 'returned' THEN
    PERFORM public.create_rental_invoice(NEW.id, 'charges');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_rental_on_status ON public.rental_orders;
CREATE TRIGGER trg_invoice_rental_on_status
  AFTER UPDATE OF status ON public.rental_orders
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('checked_out', 'returned'))
  EXECUTE FUNCTION public.invoice_rental_on_status();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Deposits
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_rental_deposit(
  p_order_id uuid, p_amount numeric, p_bank_account_id uuid, p_method text,
  p_reference text DEFAULT NULL, p_date date DEFAULT CURRENT_DATE)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  o public.rental_orders%ROWTYPE;
  v_amt numeric := round(COALESCE(p_amount, 0), 2);
  v_bank_gl uuid;
  v_dep uuid;
  v_je uuid;
  v_mov uuid;
BEGIN
  SELECT * INTO o FROM public.rental_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_post_finance(o.company_id) THEN
    RAISE EXCEPTION 'Only an admin or finance user of this company can record deposits' USING ERRCODE = '42501';
  END IF;
  IF o.status NOT IN ('approved', 'checked_out') THEN
    RAISE EXCEPTION 'Deposits are taken when the rental is approved or checked out';
  END IF;
  IF v_amt <= 0 THEN RAISE EXCEPTION 'Enter the amount received'; END IF;
  IF COALESCE(p_method, '') NOT IN ('check', 'wire', 'ach', 'cash', 'online', 'card') THEN RAISE EXCEPTION 'Choose how it was paid'; END IF;
  IF p_date IS NULL OR p_date > CURRENT_DATE THEN RAISE EXCEPTION 'The date can''t be in the future'; END IF;
  IF o.deposit_received + v_amt > COALESCE(o.deposit_total, 0) + 0.005 THEN
    RAISE EXCEPTION 'The deposit for this rental is %; % has been received already', o.deposit_total, o.deposit_received;
  END IF;

  v_bank_gl := public.bank_gl_account(o.company_id, p_bank_account_id);
  v_dep := public.gl_account_check(o.company_id, (SELECT customer_deposit_account_id FROM public.gl_settings WHERE company_id = o.company_id),
                                   'customer deposits');
  v_je := public.post_system_journal(o.company_id, p_date, 'rental_deposit', o.id, o.rental_number, 'Deposit for rental ' || o.rental_number,
    jsonb_build_array(jsonb_build_object('account_id', v_bank_gl, 'debit', v_amt, 'customer_id', o.customer_id),
                      jsonb_build_object('account_id', v_dep, 'credit', v_amt, 'customer_id', o.customer_id)));

  INSERT INTO public.rental_deposit_movements (rental_order_id, company_id, kind, amount, bank_account_id, payment_method, reference,
                                               movement_date, journal_entry_id, created_by)
  VALUES (o.id, o.company_id, 'received', v_amt, p_bank_account_id, p_method, NULLIF(btrim(COALESCE(p_reference, '')), ''),
          p_date, v_je, auth.uid())
  RETURNING id INTO v_mov;
  INSERT INTO public.bank_transactions (bank_account_id, transaction_date, transaction_type, debit_amount, credit_amount,
                                        reference_number, description, journal_entry_id, source_type, source_id, company_id, created_by)
  VALUES (p_bank_account_id, p_date, 'receipt', 0, v_amt, o.rental_number, 'Deposit for rental ' || o.rental_number, v_je,
          'rental_deposit', v_mov, o.company_id, auth.uid());
  UPDATE public.bank_accounts SET current_balance = COALESCE(current_balance, 0) + v_amt, updated_at = now() WHERE id = p_bank_account_id;
  UPDATE public.rental_orders SET deposit_received = deposit_received + v_amt, updated_at = now() WHERE id = o.id;
  RETURN v_mov;
END;
$$;

-- After the return: post the rental's draft invoices, pay what they still owe
-- from the deposit (return charges first), and refund the rest.
CREATE OR REPLACE FUNCTION public.settle_rental_deposit(
  p_order_id uuid, p_bank_account_id uuid DEFAULT NULL, p_method text DEFAULT 'cash',
  p_reference text DEFAULT NULL, p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  o public.rental_orders%ROWTYPE;
  inv public.customer_invoices%ROWTYPE;
  v_held numeric;
  v_take numeric;
  v_applied numeric := 0;
  v_refund numeric;
  v_dep uuid;
  v_ar uuid;
  v_bank_gl uuid;
  v_lines jsonb := '[]'::jsonb;
  v_je uuid;
  v_applied_to jsonb := '[]'::jsonb;
  v_mov uuid;
BEGIN
  SELECT * INTO o FROM public.rental_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_post_finance(o.company_id) THEN
    RAISE EXCEPTION 'Only an admin or finance user of this company can settle deposits' USING ERRCODE = '42501';
  END IF;
  IF o.status <> 'returned' THEN RAISE EXCEPTION 'Settle the deposit once the costumes are back'; END IF;
  v_held := round(o.deposit_received - o.deposit_applied - o.deposit_refunded, 2);
  IF v_held <= 0 THEN RAISE EXCEPTION 'No deposit is held for this rental'; END IF;
  IF p_date IS NULL OR p_date > CURRENT_DATE THEN RAISE EXCEPTION 'The date can''t be in the future'; END IF;

  -- Post any draft invoices of the rental so they can be paid.
  FOR inv IN SELECT * FROM public.customer_invoices WHERE rental_order_id = o.id AND status IN ('draft', 'pending') LOOP
    PERFORM public.post_customer_invoice(inv.id);
  END LOOP;

  v_dep := public.gl_account_check(o.company_id, (SELECT customer_deposit_account_id FROM public.gl_settings WHERE company_id = o.company_id),
                                   'customer deposits');
  -- Return charges first, then the rental itself.
  FOR inv IN SELECT * FROM public.customer_invoices
              WHERE rental_order_id = o.id AND status IN ('posted', 'partially_paid')
              ORDER BY (id = o.charges_invoice_id) DESC, invoice_date, invoice_number
              FOR UPDATE LOOP
    EXIT WHEN v_held - v_applied <= 0;
    v_take := round(LEAST(v_held - v_applied, inv.gross_amount - COALESCE(inv.amount_received, 0)), 2);
    IF v_take <= 0 THEN CONTINUE; END IF;
    v_ar := COALESCE(v_ar, public.gl_account_check(o.company_id, (SELECT ar_control_account_id FROM public.gl_settings WHERE company_id = o.company_id),
                                                   'accounts receivable'));
    UPDATE public.customer_invoices
       SET amount_received = COALESCE(amount_received, 0) + v_take,
           status = CASE WHEN COALESCE(amount_received, 0) + v_take >= gross_amount - 0.005 THEN 'paid' ELSE 'partially_paid' END,
           updated_at = now()
     WHERE id = inv.id;
    v_lines := v_lines || jsonb_build_object('account_id', v_ar, 'credit', v_take, 'customer_id', o.customer_id,
                                             'description', 'Deposit applied to ' || inv.invoice_number);
    v_applied_to := v_applied_to || jsonb_build_object('invoice_id', inv.id, 'amount', v_take);
    v_applied := v_applied + v_take;
  END LOOP;

  v_refund := round(v_held - v_applied, 2);
  IF v_refund > 0 THEN
    IF p_bank_account_id IS NULL THEN RAISE EXCEPTION 'Choose the account the refund is paid from'; END IF;
    IF COALESCE(p_method, '') NOT IN ('check', 'wire', 'ach', 'cash', 'online', 'card') THEN RAISE EXCEPTION 'Choose how the refund is paid'; END IF;
    v_bank_gl := public.bank_gl_account(o.company_id, p_bank_account_id);
    v_lines := v_lines || jsonb_build_object('account_id', v_bank_gl, 'credit', v_refund, 'customer_id', o.customer_id,
                                             'description', 'Deposit refund');
  END IF;
  v_lines := jsonb_build_array(jsonb_build_object('account_id', v_dep, 'debit', v_held, 'customer_id', o.customer_id)) || v_lines;
  v_je := public.post_system_journal(o.company_id, p_date, 'rental_deposit_settlement', o.id, o.rental_number,
                                     'Deposit settled for rental ' || o.rental_number, v_lines);

  INSERT INTO public.rental_deposit_movements (rental_order_id, company_id, kind, amount, invoice_id, movement_date, journal_entry_id, created_by)
  SELECT o.id, o.company_id, 'applied', (x->>'amount')::numeric, (x->>'invoice_id')::uuid, p_date, v_je, auth.uid()
    FROM jsonb_array_elements(v_applied_to) x;
  IF v_refund > 0 THEN
    INSERT INTO public.rental_deposit_movements (rental_order_id, company_id, kind, amount, bank_account_id, payment_method, reference,
                                                 movement_date, journal_entry_id, created_by)
    VALUES (o.id, o.company_id, 'refunded', v_refund, p_bank_account_id, p_method, NULLIF(btrim(COALESCE(p_reference, '')), ''),
            p_date, v_je, auth.uid())
    RETURNING id INTO v_mov;
    INSERT INTO public.bank_transactions (bank_account_id, transaction_date, transaction_type, debit_amount, credit_amount,
                                          reference_number, description, journal_entry_id, source_type, source_id, company_id, created_by)
    VALUES (p_bank_account_id, p_date, 'payment', v_refund, 0, o.rental_number, 'Deposit refund for rental ' || o.rental_number, v_je,
            'rental_deposit', v_mov, o.company_id, auth.uid());
    UPDATE public.bank_accounts SET current_balance = COALESCE(current_balance, 0) - v_refund, updated_at = now() WHERE id = p_bank_account_id;
  END IF;

  UPDATE public.rental_orders
     SET deposit_applied = deposit_applied + v_applied, deposit_refunded = deposit_refunded + GREATEST(v_refund, 0),
         deposit_refund = GREATEST(v_refund, 0), deposit_settled_at = now(), updated_at = now()
   WHERE id = o.id;
  RETURN jsonb_build_object('applied', v_applied, 'refunded', GREATEST(v_refund, 0), 'journal_entry_id', v_je);
END;
$$;

-- Completing needs the deposit settled; only company users can complete or cancel.
CREATE OR REPLACE FUNCTION public.complete_rental_order(p_id uuid)
RETURNS public.rental_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_order public.rental_orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.rental_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_company(v_order.company_id) THEN RAISE EXCEPTION 'Rental order % not found', p_id; END IF;
  IF v_order.status <> 'returned' THEN
    RAISE EXCEPTION 'Rental % is not returned (status: %)', v_order.rental_number, v_order.status;
  END IF;
  IF v_order.deposit_received - v_order.deposit_applied - v_order.deposit_refunded > 0.005 THEN
    RAISE EXCEPTION 'Settle the deposit held for % first', v_order.rental_number;
  END IF;
  UPDATE public.rental_orders SET status = 'completed', updated_at = now()
   WHERE id = p_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- A rental with a deposit already taken can't simply be cancelled.
CREATE OR REPLACE FUNCTION public.block_cancel_with_deposit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND OLD.deposit_received - OLD.deposit_refunded - OLD.deposit_applied > 0.005 THEN
    RAISE EXCEPTION 'A deposit was taken for this rental; refund it before cancelling';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_cancel_with_deposit ON public.rental_orders;
CREATE TRIGGER trg_block_cancel_with_deposit
  BEFORE UPDATE OF status ON public.rental_orders
  FOR EACH ROW EXECUTE FUNCTION public.block_cancel_with_deposit();

-- Refund a deposit taken for a rental that won't go ahead (approved, not checked out).
CREATE OR REPLACE FUNCTION public.refund_rental_deposit(
  p_order_id uuid, p_bank_account_id uuid, p_method text, p_reference text DEFAULT NULL, p_date date DEFAULT CURRENT_DATE)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  o public.rental_orders%ROWTYPE;
  v_held numeric;
  v_dep uuid;
  v_bank_gl uuid;
  v_je uuid;
  v_mov uuid;
BEGIN
  SELECT * INTO o FROM public.rental_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_post_finance(o.company_id) THEN
    RAISE EXCEPTION 'Only an admin or finance user of this company can refund deposits' USING ERRCODE = '42501';
  END IF;
  IF o.status <> 'approved' THEN RAISE EXCEPTION 'Once checked out, the deposit is settled after the return'; END IF;
  v_held := round(o.deposit_received - o.deposit_applied - o.deposit_refunded, 2);
  IF v_held <= 0 THEN RAISE EXCEPTION 'No deposit is held for this rental'; END IF;
  IF COALESCE(p_method, '') NOT IN ('check', 'wire', 'ach', 'cash', 'online', 'card') THEN RAISE EXCEPTION 'Choose how the refund is paid'; END IF;
  IF p_date IS NULL OR p_date > CURRENT_DATE THEN RAISE EXCEPTION 'The date can''t be in the future'; END IF;
  v_bank_gl := public.bank_gl_account(o.company_id, p_bank_account_id);
  v_dep := public.gl_account_check(o.company_id, (SELECT customer_deposit_account_id FROM public.gl_settings WHERE company_id = o.company_id),
                                   'customer deposits');
  v_je := public.post_system_journal(o.company_id, p_date, 'rental_deposit_settlement', o.id, o.rental_number,
                                     'Deposit refunded for rental ' || o.rental_number,
    jsonb_build_array(jsonb_build_object('account_id', v_dep, 'debit', v_held, 'customer_id', o.customer_id),
                      jsonb_build_object('account_id', v_bank_gl, 'credit', v_held, 'customer_id', o.customer_id)));
  INSERT INTO public.rental_deposit_movements (rental_order_id, company_id, kind, amount, bank_account_id, payment_method, reference,
                                               movement_date, journal_entry_id, created_by)
  VALUES (o.id, o.company_id, 'refunded', v_held, p_bank_account_id, p_method, NULLIF(btrim(COALESCE(p_reference, '')), ''), p_date, v_je, auth.uid())
  RETURNING id INTO v_mov;
  INSERT INTO public.bank_transactions (bank_account_id, transaction_date, transaction_type, debit_amount, credit_amount,
                                        reference_number, description, journal_entry_id, source_type, source_id, company_id, created_by)
  VALUES (p_bank_account_id, p_date, 'payment', v_held, 0, o.rental_number, 'Deposit refund for rental ' || o.rental_number, v_je,
          'rental_deposit', v_mov, o.company_id, auth.uid());
  UPDATE public.bank_accounts SET current_balance = COALESCE(current_balance, 0) - v_held, updated_at = now() WHERE id = p_bank_account_id;
  UPDATE public.rental_orders SET deposit_refunded = deposit_refunded + v_held, deposit_refund = v_held, updated_at = now() WHERE id = o.id;
  RETURN v_mov;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grants
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.record_rental_deposit(uuid, numeric, uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_rental_deposit(uuid, numeric, uuid, text, text, date) TO authenticated;
REVOKE ALL ON FUNCTION public.settle_rental_deposit(uuid, uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_rental_deposit(uuid, uuid, text, text, date) TO authenticated;
REVOKE ALL ON FUNCTION public.refund_rental_deposit(uuid, uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_rental_deposit(uuid, uuid, text, text, date) TO authenticated;
REVOKE ALL ON FUNCTION public.create_rental_invoice(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_rental_order(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN ('scale_bom_stage_cost', 'create_rental_invoice', 'record_rental_deposit',
--        'settle_rental_deposit', 'refund_rental_deposit')) AS sales_fns,  -- 5
--     (SELECT count(*) FROM public.production_stage_costs WHERE source = 'bom' AND per_unit_qty IS NULL) AS unscaled_lines;  -- 0 (cancelled orders aside)
-- ─────────────────────────────────────────────────────────────────────────────
