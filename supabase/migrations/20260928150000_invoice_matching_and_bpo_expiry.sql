-- Procurement: the three items still open after 20260928130000.
--
--   1. Invoices entered by hand in Finance can be tied to a purchase order line
--      by line, so they go through the three-way match like portal and PEPPOL
--      invoices (create_supplier_invoice_from_po).
--   2. A supplier invoice raised against a PO can't be paid until its
--      three-way match is matched, either automatically or accepted by finance
--      with a reason. Payment allocations and payment updates on the invoice
--      are refused until then.
--   3. Blanket POs expire by themselves at the end of their term, or renew for
--      another term when they are set to renew automatically. A nightly job
--      does it; releases still waiting for approval on an expired blanket PO
--      are cancelled.
--
-- Needs 20260928120000 (supplier_invoices.source) and 20260928130000
-- (three-way match functions). Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Hand-entered invoices against a PO
-- p_lines: [{po_item_id, quantity, unit_price}]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_supplier_invoice_from_po(
  p_po_id uuid,
  p_invoice_number text,
  p_invoice_date date,
  p_due_date date,
  p_lines jsonb,
  p_tax_amount numeric DEFAULT 0,
  p_currency text DEFAULT NULL,
  p_payment_terms text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_item public.po_items%ROWTYPE;
  v_invoice_id uuid;
  v_grn_id uuid;
  v_line jsonb;
  v_qty numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_n integer := 0;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
  IF NOT FOUND OR NOT public.can_access_company(v_po.company_id)
     OR NOT (public.has_finance_access(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'You can''t enter invoices for this purchase order' USING ERRCODE = '42501';
  END IF;
  IF v_po.status::text NOT IN ('approved', 'sent', 'acknowledged', 'partially_received', 'completed') THEN
    RAISE EXCEPTION 'Purchase order % is %, so it can''t be invoiced yet', v_po.po_number, replace(v_po.status::text, '_', ' ');
  END IF;
  IF NULLIF(btrim(p_invoice_number), '') IS NULL THEN RAISE EXCEPTION 'Enter the supplier''s invoice number'; END IF;
  IF p_invoice_date IS NULL OR p_due_date IS NULL THEN RAISE EXCEPTION 'Enter the invoice and due dates'; END IF;
  IF p_due_date < p_invoice_date THEN RAISE EXCEPTION 'The due date can''t be before the invoice date'; END IF;
  IF COALESCE(p_tax_amount, 0) < 0 THEN RAISE EXCEPTION 'Tax can''t be negative'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.supplier_invoices
     WHERE supplier_id = v_po.supplier_id
       AND lower(btrim(invoice_number)) = lower(btrim(p_invoice_number))
       AND COALESCE(status, '') <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Invoice % from this supplier is already recorded', btrim(p_invoice_number);
  END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Enter the invoiced quantity for at least one line';
  END IF;

  SELECT g.id INTO v_grn_id FROM public.goods_receipt_notes g
   WHERE g.po_id = p_po_id AND g.status IN ('approved', 'completed')
   ORDER BY g.approved_date DESC NULLS LAST LIMIT 1;

  INSERT INTO public.supplier_invoices (
    company_id, supplier_id, po_id, grn_id, invoice_number, invoice_date, due_date, currency,
    gross_amount, tax_amount, net_amount, amount_paid, payment_terms, status,
    three_way_match_status, source, created_by
  ) VALUES (
    v_po.company_id, v_po.supplier_id, p_po_id, v_grn_id, btrim(p_invoice_number), p_invoice_date, p_due_date,
    COALESCE(NULLIF(p_currency, ''), v_po.currency, 'LKR'),
    0, COALESCE(p_tax_amount, 0), 0, 0, COALESCE(NULLIF(p_payment_terms, ''), v_po.payment_terms), 'draft',
    'pending', 'manual', auth.uid()
  ) RETURNING id INTO v_invoice_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_item FROM public.po_items WHERE id = NULLIF(v_line->>'po_item_id', '')::uuid AND po_id = p_po_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'A line isn''t on purchase order %', v_po.po_number; END IF;
    IF v_item.id = ANY (v_seen) THEN RAISE EXCEPTION '% is entered twice', v_item.item_name; END IF;
    v_seen := v_seen || v_item.id;
    v_qty := NULLIF(v_line->>'quantity', '')::numeric;
    v_price := NULLIF(v_line->>'unit_price', '')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Enter a quantity above zero for %', v_item.item_name; END IF;
    IF v_price IS NULL OR v_price < 0 THEN RAISE EXCEPTION 'Enter the invoiced price for %', v_item.item_name; END IF;
    v_n := v_n + 1;
    INSERT INTO public.supplier_invoice_lines (invoice_id, line_number, description, quantity, unit_price, amount, tax_amount, po_item_id)
    VALUES (v_invoice_id, v_n, concat_ws(' · ', v_item.item_code, v_item.item_name), v_qty, v_price, round(v_qty * v_price, 2), 0, v_item.id);
    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
  END LOOP;

  UPDATE public.supplier_invoices
     SET net_amount = v_subtotal,
         gross_amount = v_subtotal + COALESCE(p_tax_amount, 0),
         three_way_match_status = public.evaluate_three_way_match(v_invoice_id),
         three_way_match_checked_at = now()
   WHERE id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. No payment before the match is accepted
-- ─────────────────────────────────────────────────────────────────────────────

-- Why this invoice can't be paid yet, or NULL if it can. Invoices without a
-- purchase order (services, utilities) are not affected.
CREATE OR REPLACE FUNCTION public.invoice_payment_block_reason(p_invoice_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN si.id IS NULL OR si.po_id IS NULL THEN NULL
    WHEN si.three_way_match_status IN ('matched', 'auto_matched') THEN NULL
    WHEN si.three_way_match_status = 'failed' THEN
      format('Invoice %s failed the three-way match, so it can''t be paid', si.invoice_number)
    ELSE
      format('Invoice %s can''t be paid until its three-way match is matched or accepted by finance', si.invoice_number)
  END
  FROM (SELECT 1) one
  LEFT JOIN public.supplier_invoices si ON si.id = p_invoice_id
$$;

CREATE OR REPLACE FUNCTION public.block_unmatched_invoice_allocation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF NEW.invoice_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.invoice_id = OLD.invoice_id AND NEW.amount_allocated <= OLD.amount_allocated THEN
    RETURN NEW;  -- reducing an allocation is always allowed
  END IF;
  v_reason := public.invoice_payment_block_reason(NEW.invoice_id);
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_unmatched_invoice_allocation ON public.payment_allocations;
CREATE TRIGGER trg_block_unmatched_invoice_allocation
  BEFORE INSERT OR UPDATE OF invoice_id, amount_allocated ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.block_unmatched_invoice_allocation();

-- The same rule on the invoice itself, whoever updates it.
CREATE OR REPLACE FUNCTION public.block_unmatched_invoice_payment()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.po_id IS NULL OR COALESCE(NEW.three_way_match_status, '') IN ('matched', 'auto_matched') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.amount_paid, 0) > COALESCE(OLD.amount_paid, 0)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('partially_paid', 'paid')) THEN
    RAISE EXCEPTION 'Invoice % can''t be paid until its three-way match is matched or accepted by finance', NEW.invoice_number
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_unmatched_invoice_payment ON public.supplier_invoices;
CREATE TRIGGER trg_block_unmatched_invoice_payment
  BEFORE UPDATE OF amount_paid, status ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.block_unmatched_invoice_payment();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Blanket POs expire or renew at the end of their term
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_blanket_po_lifecycle(p_today date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  b record;
  v_months integer;
  v_new date;
  v_n integer;
  n_renewed integer := 0;
  n_expired integer := 0;
  n_cancelled integer := 0;
  v_cancelled integer;
BEGIN
  FOR b IN
    SELECT * FROM public.blanket_purchase_orders
     WHERE contract_status::text IN ('active', 'suspended')
       AND contract_end_date < p_today
     FOR UPDATE
  LOOP
    IF COALESCE(b.auto_renew, false) AND b.contract_status::text = 'active' THEN
      -- Another term of the same length (whole months), catching up missed terms.
      v_months := GREATEST(1, (
        SELECT (extract(year FROM a) * 12 + extract(month FROM a) + CASE WHEN extract(day FROM a) >= 15 THEN 1 ELSE 0 END)::int
          FROM (SELECT age((b.contract_end_date + 1)::timestamp, b.contract_start_date::timestamp) AS a) t));
      v_new := b.contract_end_date;
      LOOP
        v_new := ((v_new + 1) + make_interval(months => v_months) - interval '1 day')::date;
        EXIT WHEN v_new >= p_today;
      END LOOP;
      UPDATE public.blanket_purchase_orders SET contract_end_date = v_new, updated_at = now() WHERE id = b.id;
      SELECT COUNT(*) + 1 INTO v_n FROM public.blanket_po_amendments WHERE bpo_id = b.id;
      INSERT INTO public.blanket_po_amendments (bpo_id, amendment_number, amendment_type, previous_value, new_value, reason, approved_date, notes)
      VALUES (b.id, b.bpo_number || '-R' || v_n, 'term_extension',
              jsonb_build_object('contract_end_date', b.contract_end_date),
              jsonb_build_object('contract_end_date', v_new),
              'Renewed automatically at the end of its term',
              now(), format('Extended by %s month%s; the remaining value carries over', v_months, CASE WHEN v_months = 1 THEN '' ELSE 's' END));
      n_renewed := n_renewed + 1;
    ELSE
      UPDATE public.blanket_purchase_orders SET contract_status = 'expired', updated_at = now() WHERE id = b.id;
      UPDATE public.blanket_po_releases
         SET release_status = 'cancelled', decision_notes = 'Blanket PO expired before this release was approved', updated_at = now()
       WHERE bpo_id = b.id AND release_status::text IN ('draft', 'submitted');
      GET DIAGNOSTICS v_cancelled = ROW_COUNT;
      n_cancelled := n_cancelled + v_cancelled;
      n_expired := n_expired + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('renewed', n_renewed, 'expired', n_expired, 'releases_cancelled', n_cancelled, 'run_for', p_today);
END;
$$;

REVOKE ALL ON FUNCTION public.run_blanket_po_lifecycle(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_blanket_po_lifecycle(date) TO service_role;

-- Nightly at 00:35 UTC, after the contract job (00:30).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'blanket-po-lifecycle-daily';
    PERFORM cron.schedule('blanket-po-lifecycle-daily', '35 0 * * *', $job$ SELECT public.run_blanket_po_lifecycle(); $job$);
  END IF;
END $$;

-- Catch up now for blanket POs already past their end date.
SELECT public.run_blanket_po_lifecycle();

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.create_supplier_invoice_from_po(uuid, text, date, date, jsonb, numeric, text, text)',
    'public.invoice_payment_block_reason(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Check (read-only), after running:
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'blanket-po-lifecycle-daily';
--   SELECT count(*) FROM blanket_purchase_orders WHERE contract_status IN ('active','suspended') AND contract_end_date < CURRENT_DATE;  -- expect 0
