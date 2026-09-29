-- Finance: warehouse stock movements post to the ledger, and accounting periods
-- are opened, closed and enforced.
--
-- 1. Stock to ledger. Each company names its inventory accounts in GL Settings
--    (inventory, goods received not invoiced, materials consumed, optional
--    production WIP, stock adjustments) and the date posting starts. From then
--    on the warehouse's stock movements are posted, one journal per document:
--      goods receipt       Dr inventory            Cr goods received not invoiced
--      material issue      Dr materials consumed   Cr inventory
--      production issue    Dr WIP (or consumed)    Cr inventory
--      material return     Dr inventory            Cr materials consumed
--      adjustments / scrap Dr inventory or adjustments, per day
--    Receipts are valued at their net purchase price (converted at the spot
--    rate for foreign-currency POs); other movements at the item's cost (its
--    last net purchase price). Transfers, tool loans, cycle-count entries that
--    don't move stock, and supplier returns aren't posted. Posting runs every
--    hour, from Finance on demand, and before a period is closed. A movement
--    dated in a closed period is posted on the first day of the next open one.
-- 2. Posting a supplier invoice for a PO or GRN clears goods received not
--    invoiced (up to what is still open on it) instead of charging purchases.
-- 3. Fiscal years: opening one creates its twelve monthly periods. A period is
--    closed in order, once no draft journal and no unposted stock movement is
--    dated in it; an admin can reopen the latest closed one with a reason. A
--    year is closed once its periods are: revenue and expenses are closed to
--    retained earnings and its periods are locked.
-- 4. Every journal is tied to the period its date falls in. Posting or voiding
--    in a closed period is refused (an admin may when GL Settings allows posting
--    to closed periods; never in a locked one), and once a company has periods,
--    a date outside them is refused.
--
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Settings and columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gl_settings
  ADD COLUMN IF NOT EXISTS inventory_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grni_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_consumption_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_wip_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stock_adjustment_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retained_earnings_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stock_posting_start_date date;

ALTER TABLE public.accounting_periods
  ADD COLUMN IF NOT EXISTS reopened_by uuid,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_reason text;
ALTER TABLE public.fiscal_years
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closing_journal_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_periods_company_dates ON public.accounting_periods (company_id, start_date, end_date);

-- Opening and closing periods and years: admins and senior finance of the company.
CREATE OR REPLACE FUNCTION public.can_manage_periods(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.can_access_company(p_company_id)
     AND (public.is_admin(auth.uid()) OR public.has_senior_finance_access(auth.uid()))
$$;

-- Spot rate from a currency to the company's base currency on (or before) a date;
-- company rates first, the inverse pair if only that exists; NULL when unknown.
CREATE OR REPLACE FUNCTION public.fx_rate_to_base(p_company_id uuid, p_currency text, p_date date)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH b AS (SELECT upper(COALESCE((SELECT base_currency FROM public.gl_settings WHERE company_id = p_company_id), 'LKR')) AS base,
                    upper(COALESCE(NULLIF(btrim(p_currency), ''), (SELECT base_currency FROM public.gl_settings WHERE company_id = p_company_id), 'LKR')) AS cur)
  SELECT CASE WHEN b.cur = b.base THEN 1::numeric ELSE (
    SELECT r.rate FROM (
      SELECT er.exchange_rate AS rate, er.rate_date AS rd, (er.company_id IS NOT NULL) AS own, 0 AS inv
        FROM public.exchange_rates er
       WHERE upper(er.from_currency) = b.cur AND upper(er.to_currency) = b.base
         AND COALESCE(er.rate_type, 'spot') = 'spot' AND er.rate_date <= p_date AND er.exchange_rate > 0
         AND (er.company_id = p_company_id OR er.company_id IS NULL)
      UNION ALL
      SELECT 1 / er.exchange_rate, er.rate_date, (er.company_id IS NOT NULL), 1
        FROM public.exchange_rates er
       WHERE upper(er.from_currency) = b.base AND upper(er.to_currency) = b.cur
         AND COALESCE(er.rate_type, 'spot') = 'spot' AND er.rate_date <= p_date AND er.exchange_rate > 0
         AND (er.company_id = p_company_id OR er.company_id IS NULL)
    ) r ORDER BY r.rd DESC, r.own DESC, r.inv ASC LIMIT 1) END
    FROM b
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Journals follow their period
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_journal_period()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p record;
  v_posting boolean;
  v_unposting boolean;
  v_override boolean := COALESCE(current_setting('app.period_override', true), '') = 'on';
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, status::text AS status, period_name INTO p
    FROM public.accounting_periods
   WHERE company_id = NEW.company_id AND NEW.journal_date BETWEEN start_date AND end_date
   ORDER BY start_date LIMIT 1;
  NEW.period_id := p.id;

  v_posting := NEW.status::text = 'posted' AND (TG_OP = 'INSERT' OR OLD.status::text <> 'posted'
                                                OR NEW.journal_date IS DISTINCT FROM OLD.journal_date);
  v_unposting := TG_OP = 'UPDATE' AND OLD.status::text = 'posted' AND NEW.status::text <> 'posted';
  IF NOT (v_posting OR v_unposting) THEN RETURN NEW; END IF;

  IF p.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.accounting_periods WHERE company_id = NEW.company_id) THEN
      RAISE EXCEPTION 'No accounting period covers %; open that fiscal year first', NEW.journal_date;
    END IF;
    RETURN NEW;
  END IF;
  IF p.status = 'locked' THEN
    RAISE EXCEPTION 'The period % is locked (its year is closed)', p.period_name;
  END IF;
  IF p.status = 'closed' AND NOT v_override
     AND NOT (COALESCE((SELECT allow_posting_to_closed_periods FROM public.gl_settings WHERE company_id = NEW.company_id), false)
              AND public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'The period % is closed', p.period_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_journal_period ON public.journal_entries;
CREATE TRIGGER trg_assign_journal_period
  BEFORE INSERT OR UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.assign_journal_period();

-- The old check (period_id, which nothing set) is superseded by the one above.
CREATE OR REPLACE FUNCTION public.check_period_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Tie existing journals to their periods (where periods exist).
UPDATE public.journal_entries je
   SET period_id = ap.id
  FROM public.accounting_periods ap
 WHERE ap.company_id = je.company_id AND je.journal_date BETWEEN ap.start_date AND ap.end_date
   AND je.period_id IS DISTINCT FROM ap.id;

-- System journals can't be voided on their own.
CREATE OR REPLACE FUNCTION public.guard_system_journal_void()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND OLD.status = 'posted' AND NEW.status IN ('void', 'reversed', 'draft')
     AND OLD.reference_type IN ('supplier_invoice', 'customer_invoice', 'supplier_payment', 'customer_receipt',
                                'stock_grn', 'stock_issue', 'stock_production', 'stock_return', 'stock_adjustment',
                                'rental_deposit', 'rental_deposit_settlement', 'year_end_close') THEN
    RAISE EXCEPTION 'This journal was written by the system for a document and can''t be voided on its own' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Stock to ledger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_ledger_postings (
  stock_transaction_id uuid PRIMARY KEY REFERENCES public.stock_transactions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  kind text NOT NULL,
  value numeric(15,2) NOT NULL DEFAULT 0,
  posted_on date,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('posted', 'skipped')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_postings_company ON public.stock_ledger_postings (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_company_created ON public.stock_transactions (company_id, created_at);
ALTER TABLE public.stock_ledger_postings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users can view stock ledger postings" ON public.stock_ledger_postings;
CREATE POLICY "Company users can view stock ledger postings" ON public.stock_ledger_postings
  FOR SELECT TO authenticated USING (public.can_access_company(company_id));

-- The first open day on or after a date (the date itself when its period is
-- open, or when the company has no periods yet); NULL when there is none.
CREATE OR REPLACE FUNCTION public.first_open_posting_date(p_company_id uuid, p_date date)
RETURNS date
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.accounting_periods WHERE company_id = p_company_id) THEN
    RETURN p_date;
  END IF;
  SELECT status::text INTO v_status FROM public.accounting_periods
   WHERE company_id = p_company_id AND p_date BETWEEN start_date AND end_date ORDER BY start_date LIMIT 1;
  IF v_status = 'open' THEN RETURN p_date; END IF;
  RETURN (SELECT MIN(start_date) FROM public.accounting_periods
           WHERE company_id = p_company_id AND status::text = 'open' AND start_date > p_date);
END;
$$;

-- Unposted stock movements of a company up to a date, classified and valued.
CREATE OR REPLACE FUNCTION public.stock_ledger_candidates(p_company_id uuid, p_up_to date)
RETURNS TABLE (st_id uuid, kind text, doc_key text, doc_ref text, move_date date, value numeric, supplier_id uuid, problem text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH s AS (SELECT stock_posting_start_date AS start FROM public.gl_settings WHERE company_id = p_company_id),
  raw AS (
    SELECT st.id, st.transaction_type::text AS tt, st.reference_type::text AS rt, st.reference_id, st.notes,
           st.quantity_change AS q, st.unit_cost, st.total_value, (st.created_at AT TIME ZONE 'Asia/Colombo')::date AS d,
           wi.unit_cost AS item_cost,
           g.id AS grn_id, g.grn_number, g.supplier_id, po.currency AS po_currency,
           mi.id AS min_id, mi.min_number,
           mr.id AS mrn_id, mr.mrn_number, mr.return_type
      FROM public.stock_transactions st
      CROSS JOIN s
      LEFT JOIN public.warehouse_items wi ON wi.id = st.item_id
      LEFT JOIN public.goods_receipt_notes g ON st.reference_type::text = 'grn' AND g.id = st.reference_id
      LEFT JOIN public.purchase_orders po ON po.id = g.po_id
      LEFT JOIN public.material_issue_notes mi ON st.transaction_type::text = 'material_issue' AND mi.id = st.reference_id
      LEFT JOIN public.material_return_notes mr ON st.transaction_type::text = 'material_return' AND mr.id = st.reference_id
     WHERE st.company_id = p_company_id
       AND s.start IS NOT NULL
       AND (st.created_at AT TIME ZONE 'Asia/Colombo')::date >= s.start
       AND (st.created_at AT TIME ZONE 'Asia/Colombo')::date <= p_up_to
       AND NOT EXISTS (SELECT 1 FROM public.stock_ledger_postings slp WHERE slp.stock_transaction_id = st.id)
  ),
  k AS (
    SELECT r.*,
      CASE
        WHEN r.tt = 'goods_receipt' AND r.grn_id IS NOT NULL THEN 'grn'
        WHEN r.tt = 'material_issue' AND r.min_id IS NOT NULL THEN 'issue'
        WHEN r.tt = 'material_issue' AND r.reference_id IS NULL AND r.notes ~ 'PROD-' THEN 'production'
        WHEN r.tt = 'material_return' AND r.mrn_id IS NOT NULL AND r.return_type = 'internal' THEN 'return'
        WHEN r.tt = 'adjustment' AND r.rt <> 'manual' AND r.q <> 0 THEN 'adjustment'
        ELSE 'skip'
      END AS kind,
      CASE WHEN r.tt = 'goods_receipt' THEN public.fx_rate_to_base(p_company_id, r.po_currency, r.d) END AS fx
      FROM raw r
  )
  SELECT k.id, k.kind,
         k.kind || ':' || COALESCE(k.grn_id::text, k.min_id::text, k.mrn_id::text, substring(k.notes FROM 'PROD-[^ ,;)]*'), '') || ':' || k.d,
         COALESCE(k.grn_number, k.min_number, k.mrn_number, substring(k.notes FROM 'PROD-[^ ,;)]*'), to_char(k.d, 'DD Mon YYYY')),
         k.d,
         CASE
           WHEN k.kind = 'grn' THEN round(COALESCE(NULLIF(k.total_value, 0), abs(k.q) * COALESCE(k.unit_cost, 0)) * k.fx, 2)
           WHEN k.kind = 'skip' THEN 0
           ELSE round(abs(k.q) * COALESCE(NULLIF(k.unit_cost, 0), NULLIF(k.item_cost, 0), 0), 2) * sign(k.q)
         END,
         k.supplier_id,
         CASE WHEN k.kind = 'grn' AND k.fx IS NULL THEN 'No exchange rate for ' || upper(k.po_currency) || ' on ' || k.d END
    FROM k
$$;

-- Posts a company's pending stock movements up to a date (internal).
CREATE OR REPLACE FUNCTION public.post_stock_to_ledger_core(p_company_id uuid, p_up_to date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.gl_settings%ROWTYPE;
  g record;
  v_date date;
  v_lines jsonb;
  v_je uuid;
  v_journals integer := 0;
  v_rows integer := 0;
  v_problems jsonb := '[]'::jsonb;
  v_counter uuid;
  v_ref_type text;
  v_desc text;
BEGIN
  SELECT * INTO s FROM public.gl_settings WHERE company_id = p_company_id;
  IF NOT FOUND OR s.inventory_account_id IS NULL OR s.stock_posting_start_date IS NULL THEN
    RETURN jsonb_build_object('configured', false, 'journals', 0, 'rows', 0, 'problems', '[]'::jsonb);
  END IF;
  CREATE TEMP TABLE IF NOT EXISTS _slc (st_id uuid, kind text, doc_key text, doc_ref text, move_date date, value numeric, supplier_id uuid, problem text)
    ON COMMIT DROP;
  TRUNCATE _slc;
  INSERT INTO _slc SELECT * FROM public.stock_ledger_candidates(p_company_id, p_up_to);

  -- Movements that don't touch the ledger.
  INSERT INTO public.stock_ledger_postings (stock_transaction_id, company_id, kind, value, status, note)
  SELECT st_id, p_company_id, 'skip', 0, 'skipped', 'Not a ledger movement (transfer, tool loan, count or supplier return)'
    FROM _slc WHERE kind = 'skip'
  ON CONFLICT (stock_transaction_id) DO NOTHING;
  -- Movements without any cost on record.
  INSERT INTO public.stock_ledger_postings (stock_transaction_id, company_id, kind, value, status, note)
  SELECT st_id, p_company_id, kind, 0, 'skipped', 'No cost on record for the item'
    FROM _slc WHERE kind <> 'skip' AND problem IS NULL AND COALESCE(value, 0) = 0
  ON CONFLICT (stock_transaction_id) DO NOTHING;

  FOR g IN
    SELECT doc_key, kind, MIN(doc_ref) AS doc_ref, MIN(move_date) AS move_date,
           SUM(value) FILTER (WHERE value > 0) AS plus, -SUM(value) FILTER (WHERE value < 0) AS minus,
           MIN(supplier_id::text)::uuid AS supplier_id, array_agg(st_id) AS ids, MIN(problem) AS problem
      FROM _slc WHERE kind <> 'skip' AND (problem IS NOT NULL OR COALESCE(value, 0) <> 0)
     GROUP BY doc_key, kind ORDER BY MIN(move_date), doc_key
  LOOP
    IF g.problem IS NOT NULL THEN
      v_problems := v_problems || jsonb_build_object('document', g.doc_ref, 'kind', g.kind, 'problem', g.problem);
      CONTINUE;
    END IF;
    v_date := public.first_open_posting_date(p_company_id, g.move_date);
    IF v_date IS NULL THEN
      v_problems := v_problems || jsonb_build_object('document', g.doc_ref, 'kind', g.kind,
                                                     'problem', 'No open period on or after ' || g.move_date || '; open the next fiscal year');
      CONTINUE;
    END IF;
    v_counter := CASE g.kind
      WHEN 'grn' THEN s.grni_account_id
      WHEN 'issue' THEN s.material_consumption_account_id
      WHEN 'production' THEN COALESCE(s.production_wip_account_id, s.material_consumption_account_id)
      WHEN 'return' THEN s.material_consumption_account_id
      WHEN 'adjustment' THEN s.stock_adjustment_account_id END;
    IF v_counter IS NULL THEN
      v_problems := v_problems || jsonb_build_object('document', g.doc_ref, 'kind', g.kind,
        'problem', 'Set the ' || CASE g.kind WHEN 'grn' THEN 'goods received not invoiced' WHEN 'adjustment' THEN 'stock adjustments'
                                              ELSE 'materials consumed' END || ' account in GL Settings');
      CONTINUE;
    END IF;
    v_ref_type := CASE g.kind WHEN 'grn' THEN 'stock_grn' WHEN 'issue' THEN 'stock_issue' WHEN 'production' THEN 'stock_production'
                              WHEN 'return' THEN 'stock_return' ELSE 'stock_adjustment' END;
    v_desc := CASE g.kind WHEN 'grn' THEN 'Goods received ' WHEN 'issue' THEN 'Materials issued ' WHEN 'production' THEN 'Production materials '
                          WHEN 'return' THEN 'Materials returned ' ELSE 'Stock adjustments ' END || g.doc_ref
              || CASE WHEN v_date <> g.move_date THEN ' (moved ' || to_char(g.move_date, 'DD Mon YYYY') || ', period closed)' ELSE '' END;
    v_lines := '[]'::jsonb;
    IF g.kind IN ('grn', 'return') OR (g.kind = 'adjustment' AND COALESCE(g.plus, 0) > 0) THEN
      v_lines := v_lines
        || jsonb_build_object('account_id', public.gl_account_check(p_company_id, s.inventory_account_id, 'inventory'), 'debit', COALESCE(g.plus, 0))
        || jsonb_build_object('account_id', public.gl_account_check(p_company_id, v_counter, 'stock counterpart'), 'credit', COALESCE(g.plus, 0),
                              'supplier_id', g.supplier_id);
    END IF;
    IF g.kind IN ('issue', 'production') OR (g.kind = 'adjustment' AND COALESCE(g.minus, 0) > 0) THEN
      v_lines := v_lines
        || jsonb_build_object('account_id', public.gl_account_check(p_company_id, v_counter, 'stock counterpart'),
                              'debit', CASE WHEN g.kind = 'adjustment' THEN g.minus ELSE COALESCE(g.minus, 0) + COALESCE(g.plus, 0) END)
        || jsonb_build_object('account_id', public.gl_account_check(p_company_id, s.inventory_account_id, 'inventory'),
                              'credit', CASE WHEN g.kind = 'adjustment' THEN g.minus ELSE COALESCE(g.minus, 0) + COALESCE(g.plus, 0) END);
    END IF;
    v_je := public.post_system_journal(p_company_id, v_date, v_ref_type, NULL, g.doc_ref, v_desc, v_lines);
    INSERT INTO public.stock_ledger_postings (stock_transaction_id, company_id, kind, value, posted_on, journal_entry_id, status)
    SELECT c.st_id, p_company_id, g.kind, abs(COALESCE(c.value, 0)), v_date, v_je, 'posted'
      FROM _slc c WHERE c.st_id = ANY (g.ids)
    ON CONFLICT (stock_transaction_id) DO NOTHING;
    v_journals := v_journals + 1;
    v_rows := v_rows + cardinality(g.ids);
  END LOOP;
  RETURN jsonb_build_object('configured', true, 'journals', v_journals, 'rows', v_rows, 'problems', v_problems);
END;
$$;

CREATE OR REPLACE FUNCTION public.post_stock_to_ledger(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_post_finance(p_company_id) THEN
    RAISE EXCEPTION 'Only finance users of this company can post stock to the ledger' USING ERRCODE = '42501';
  END IF;
  RETURN public.post_stock_to_ledger_core(p_company_id, (now() AT TIME ZONE 'Asia/Colombo')::date);
END;
$$;

-- For the Finance screen: what is waiting and why.
CREATE OR REPLACE FUNCTION public.stock_ledger_status(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.gl_settings%ROWTYPE;
  v jsonb;
BEGIN
  IF NOT public.can_access_company(p_company_id) THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.gl_settings WHERE company_id = p_company_id;
  SELECT jsonb_build_object(
    'configured', s.inventory_account_id IS NOT NULL AND s.stock_posting_start_date IS NOT NULL,
    'start_date', s.stock_posting_start_date,
    'pending', (SELECT count(*) FROM public.stock_ledger_candidates(p_company_id, (now() AT TIME ZONE 'Asia/Colombo')::date) c WHERE c.kind <> 'skip'),
    'pending_value', (SELECT COALESCE(SUM(abs(c.value)), 0) FROM public.stock_ledger_candidates(p_company_id, (now() AT TIME ZONE 'Asia/Colombo')::date) c WHERE c.kind <> 'skip'),
    'problems', COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object('document', c.doc_ref, 'problem', c.problem))
                            FROM public.stock_ledger_candidates(p_company_id, (now() AT TIME ZONE 'Asia/Colombo')::date) c WHERE c.problem IS NOT NULL), '[]'::jsonb),
    'posted_value_30d', (SELECT COALESCE(SUM(value), 0) FROM public.stock_ledger_postings
                          WHERE company_id = p_company_id AND status = 'posted' AND created_at > now() - interval '30 days'),
    'no_cost_30d', (SELECT count(*) FROM public.stock_ledger_postings
                     WHERE company_id = p_company_id AND status = 'skipped' AND kind <> 'skip' AND created_at > now() - interval '30 days'),
    'last_posted_at', (SELECT MAX(created_at) FROM public.stock_ledger_postings WHERE company_id = p_company_id AND status = 'posted'))
  INTO v;
  RETURN v;
END;
$$;

-- Hourly job: every configured company (one company's error doesn't stop the rest).
CREATE OR REPLACE FUNCTION public.run_stock_ledger_posting()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c uuid;
  n integer := 0;
BEGIN
  FOR c IN SELECT company_id FROM public.gl_settings
            WHERE company_id IS NOT NULL AND inventory_account_id IS NOT NULL AND stock_posting_start_date IS NOT NULL LOOP
    BEGIN
      PERFORM public.post_stock_to_ledger_core(c, (now() AT TIME ZONE 'Asia/Colombo')::date);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Stock posting for company % failed: %', c, SQLERRM;
    END;
  END LOOP;
  RETURN n;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'stock-ledger-hourly';
    PERFORM cron.schedule('stock-ledger-hourly', '20 * * * *', $job$ SELECT public.run_stock_ledger_posting(); $job$);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Supplier invoices clear goods received not invoiced
-- ─────────────────────────────────────────────────────────────────────────────
-- What is still open on GRNI for an invoice's PO / GRN, in base currency.
CREATE OR REPLACE FUNCTION public.grni_open_for_invoice(p_invoice_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv public.supplier_invoices%ROWTYPE;
  v_grni uuid;
  v_received numeric;
  v_cleared numeric;
BEGIN
  SELECT * INTO inv FROM public.supplier_invoices WHERE id = p_invoice_id;
  SELECT grni_account_id INTO v_grni FROM public.gl_settings WHERE company_id = inv.company_id;
  IF v_grni IS NULL OR (inv.po_id IS NULL AND inv.grn_id IS NULL) THEN RETURN 0; END IF;
  -- Received: GRNI credits of the receipt journals of this PO (or this GRN).
  SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_received
    FROM public.journal_entry_lines l
    JOIN public.journal_entries je ON je.id = l.journal_entry_id AND je.status::text = 'posted'
   WHERE l.account_id = v_grni
     AND l.journal_entry_id IN (
       SELECT slp.journal_entry_id FROM public.stock_ledger_postings slp
         JOIN public.stock_transactions st ON st.id = slp.stock_transaction_id
         JOIN public.goods_receipt_notes g ON g.id = st.reference_id
        WHERE slp.kind = 'grn' AND slp.status = 'posted'
          AND (g.id = inv.grn_id OR (inv.po_id IS NOT NULL AND g.po_id = inv.po_id)));
  -- Cleared: GRNI debits by posted invoices of the same PO / GRN.
  SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_cleared
    FROM public.journal_entry_lines l
    JOIN public.journal_entries je ON je.id = l.journal_entry_id AND je.status::text = 'posted'
    JOIN public.supplier_invoices si ON si.journal_entry_id = je.id
   WHERE l.account_id = v_grni AND si.id <> inv.id
     AND ((inv.po_id IS NOT NULL AND si.po_id = inv.po_id) OR (inv.grn_id IS NOT NULL AND si.grn_id = inv.grn_id));
  RETURN GREATEST(round(v_received - v_cleared, 2), 0);
END;
$$;

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
  v_default numeric := 0;
  v_to_grni numeric := 0;
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

  -- Lines with their own account keep it; the rest is purchases, or clears
  -- goods received not invoiced when the goods were received against this PO / GRN.
  IF EXISTS (SELECT 1 FROM public.supplier_invoice_lines WHERE invoice_id = inv.id) THEN
    FOR l IN SELECT * FROM public.supplier_invoice_lines WHERE invoice_id = inv.id ORDER BY line_number LOOP
      IF COALESCE(l.gl_account_id, inv.gl_account_id) IS NOT NULL THEN
        v_lines := v_lines || jsonb_build_object(
          'account_id', public.gl_account_check(inv.company_id, COALESCE(l.gl_account_id, inv.gl_account_id), 'purchases'),
          'debit', l.amount * v_fx, 'description', COALESCE(l.description, inv.invoice_number), 'supplier_id', inv.supplier_id);
      ELSE
        v_default := v_default + l.amount * v_fx;
      END IF;
    END LOOP;
  ELSIF inv.gl_account_id IS NOT NULL THEN
    v_lines := v_lines || jsonb_build_object('account_id', public.gl_account_check(inv.company_id, inv.gl_account_id, 'purchases'),
                                             'debit', v_net * v_fx, 'supplier_id', inv.supplier_id);
  ELSE
    v_default := v_net * v_fx;
  END IF;
  IF v_default > 0 THEN
    v_to_grni := LEAST(round(v_default, 2), public.grni_open_for_invoice(inv.id));
    IF v_to_grni > 0 THEN
      v_lines := v_lines || jsonb_build_object('account_id', public.gl_account_check(inv.company_id, s.grni_account_id, 'goods received not invoiced'),
                                               'debit', v_to_grni, 'description', 'Goods received, now invoiced', 'supplier_id', inv.supplier_id);
    END IF;
    IF round(v_default, 2) - v_to_grni > 0 THEN
      v_lines := v_lines || jsonb_build_object('account_id', public.gl_account_check(inv.company_id, s.purchases_account_id, 'purchases'),
                                               'debit', round(v_default, 2) - v_to_grni,
                                               'description', CASE WHEN v_to_grni > 0 THEN 'Invoiced above the value received' END,
                                               'supplier_id', inv.supplier_id);
    END IF;
  END IF;
  IF v_tax > 0 THEN
    v_lines := v_lines || jsonb_build_object('account_id', public.gl_account_check(inv.company_id, s.input_tax_account_id, 'input tax'),
                                             'debit', v_tax * v_fx, 'description', 'Input tax');
  END IF;
  -- Rounding: the credit is the sum of the debits.
  v_lines := v_lines || jsonb_build_object('account_id', public.gl_account_check(inv.company_id, s.ap_control_account_id, 'accounts payable'),
    'credit', (SELECT SUM(round(COALESCE((x->>'debit')::numeric, 0), 2)) FROM jsonb_array_elements(v_lines) x),
    'supplier_id', inv.supplier_id);

  v_je := public.post_system_journal(inv.company_id, inv.invoice_date, 'supplier_invoice', inv.id, inv.invoice_number,
                                     'Supplier invoice ' || inv.invoice_number, v_lines);
  UPDATE public.supplier_invoices
     SET status = 'posted', posted_by = auth.uid(), posted_date = now(), journal_entry_id = v_je, updated_at = now()
   WHERE id = inv.id;
  RETURN v_je;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Fiscal years and periods
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_fiscal_year(p_company_id uuid, p_start_date date, p_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_last date;
  v_end date;
  v_fy integer;
  v_id uuid;
  i integer;
  v_ps date;
BEGIN
  IF NOT public.can_manage_periods(p_company_id) THEN
    RAISE EXCEPTION 'Only an admin or senior finance user of this company can open fiscal years' USING ERRCODE = '42501';
  END IF;
  IF p_start_date IS NULL OR EXTRACT(DAY FROM p_start_date) <> 1 THEN
    RAISE EXCEPTION 'A fiscal year starts on the first day of a month';
  END IF;
  SELECT MAX(end_date) INTO v_last FROM public.fiscal_years WHERE company_id = p_company_id;
  IF v_last IS NOT NULL AND p_start_date <> v_last + 1 THEN
    RAISE EXCEPTION 'The next fiscal year starts on %', to_char(v_last + 1, 'DD Mon YYYY');
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_periods WHERE company_id = p_company_id
              AND start_date <= (p_start_date + interval '1 year' - interval '1 day')::date AND end_date >= p_start_date) THEN
    RAISE EXCEPTION 'Periods already exist in those dates';
  END IF;
  v_end := (p_start_date + interval '1 year' - interval '1 day')::date;
  v_fy := EXTRACT(YEAR FROM v_end)::int;
  INSERT INTO public.fiscal_years (year_name, fiscal_year, start_date, end_date, status, is_current, company_id)
  VALUES (COALESCE(NULLIF(btrim(COALESCE(p_name, '')), ''),
                   CASE WHEN EXTRACT(MONTH FROM p_start_date) = 1 THEN 'FY ' || v_fy
                        ELSE 'FY ' || EXTRACT(YEAR FROM p_start_date) || '/' || to_char(v_end, 'YY') END),
          v_fy, p_start_date, v_end, 'open', CURRENT_DATE BETWEEN p_start_date AND v_end, p_company_id)
  RETURNING id INTO v_id;
  FOR i IN 1..12 LOOP
    v_ps := (p_start_date + make_interval(months => i - 1))::date;
    INSERT INTO public.accounting_periods (period_name, fiscal_year, period_number, start_date, end_date, status, company_id)
    VALUES (to_char(v_ps, 'Mon YYYY'), v_fy, i, v_ps, (v_ps + interval '1 month' - interval '1 day')::date, 'open', p_company_id);
  END LOOP;
  -- Journals already dated in the new year join their periods.
  UPDATE public.journal_entries je SET period_id = ap.id
    FROM public.accounting_periods ap
   WHERE ap.company_id = p_company_id AND ap.fiscal_year = v_fy AND je.company_id = p_company_id
     AND je.journal_date BETWEEN ap.start_date AND ap.end_date;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_accounting_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.accounting_periods%ROWTYPE;
  v_drafts integer;
  v_stock jsonb;
  v_left integer;
BEGIN
  SELECT * INTO p FROM public.accounting_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_periods(p.company_id) THEN
    RAISE EXCEPTION 'Only an admin or senior finance user of this company can close periods' USING ERRCODE = '42501';
  END IF;
  IF p.status::text <> 'open' THEN RAISE EXCEPTION '% is already %', p.period_name, p.status; END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_periods WHERE company_id = p.company_id AND start_date < p.start_date AND status::text = 'open') THEN
    RAISE EXCEPTION 'Close the earlier periods first';
  END IF;
  SELECT count(*) INTO v_drafts FROM public.journal_entries
   WHERE company_id = p.company_id AND status::text = 'draft' AND journal_date BETWEEN p.start_date AND p.end_date;
  IF v_drafts > 0 THEN
    RAISE EXCEPTION '% draft journal(s) are dated in %; post or delete them first', v_drafts, p.period_name;
  END IF;
  -- Stock movements of the period go to the ledger first.
  v_stock := public.post_stock_to_ledger_core(p.company_id, p.end_date);
  IF COALESCE((v_stock->>'configured')::boolean, false) THEN
    SELECT count(*) INTO v_left FROM public.stock_ledger_candidates(p.company_id, p.end_date) c
     WHERE c.kind <> 'skip' AND c.move_date BETWEEN p.start_date AND p.end_date;
    IF v_left > 0 THEN
      RAISE EXCEPTION '% stock movement(s) of % can''t be posted yet: %', v_left, p.period_name,
        COALESCE((SELECT string_agg(DISTINCT x->>'document' || ' – ' || (x->>'problem'), '; ')
                    FROM jsonb_array_elements(v_stock->'problems') x), 'see Stock to ledger');
    END IF;
  END IF;
  UPDATE public.accounting_periods
     SET status = 'closed', closed_by = auth.uid(), closed_date = now(), updated_at = now()
   WHERE id = p_period_id;
  RETURN jsonb_build_object('status', 'closed', 'stock_journals', COALESCE((v_stock->>'journals')::int, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_accounting_period(p_period_id uuid, p_reason text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.accounting_periods%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.accounting_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_company(p.company_id) OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin of this company can reopen a period' USING ERRCODE = '42501';
  END IF;
  IF p.status::text = 'locked' THEN RAISE EXCEPTION '% belongs to a closed year and is locked', p.period_name; END IF;
  IF p.status::text <> 'closed' THEN RAISE EXCEPTION '% isn''t closed', p.period_name; END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_periods WHERE company_id = p.company_id AND start_date > p.start_date AND status::text <> 'open') THEN
    RAISE EXCEPTION 'Reopen the later periods first';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Give a reason for reopening'; END IF;
  UPDATE public.accounting_periods
     SET status = 'open', reopened_by = auth.uid(), reopened_at = now(), reopen_reason = btrim(p_reason), updated_at = now()
   WHERE id = p_period_id;
  RETURN 'open';
END;
$$;

-- Closing a year: revenue and expense balances of the year go to retained
-- earnings (one closing journal on its last day), and its periods are locked.
CREATE OR REPLACE FUNCTION public.close_fiscal_year(p_fiscal_year_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  fy public.fiscal_years%ROWTYPE;
  v_re uuid;
  v_lines jsonb := '[]'::jsonb;
  v_net numeric := 0;
  v_je uuid;
  a record;
BEGIN
  SELECT * INTO fy FROM public.fiscal_years WHERE id = p_fiscal_year_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_periods(fy.company_id) THEN
    RAISE EXCEPTION 'Only an admin or senior finance user of this company can close a year' USING ERRCODE = '42501';
  END IF;
  IF fy.status::text <> 'open' THEN RAISE EXCEPTION '% is already closed', fy.year_name; END IF;
  IF EXISTS (SELECT 1 FROM public.fiscal_years WHERE company_id = fy.company_id AND start_date < fy.start_date AND status::text = 'open') THEN
    RAISE EXCEPTION 'Close the earlier year first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_periods
              WHERE company_id = fy.company_id AND start_date >= fy.start_date AND end_date <= fy.end_date AND status::text = 'open') THEN
    RAISE EXCEPTION 'Close all of the year''s periods first';
  END IF;
  v_re := public.gl_account_check(fy.company_id, (SELECT retained_earnings_account_id FROM public.gl_settings WHERE company_id = fy.company_id),
                                  'retained earnings');

  FOR a IN
    SELECT coa.id, coa.account_type::text AS t, round(SUM(l.debit_amount - l.credit_amount), 2) AS bal
      FROM public.journal_entry_lines l
      JOIN public.journal_entries je ON je.id = l.journal_entry_id
      JOIN public.chart_of_accounts coa ON coa.id = l.account_id
     WHERE je.company_id = fy.company_id AND je.status::text = 'posted'
       AND je.journal_date BETWEEN fy.start_date AND fy.end_date
       AND COALESCE(je.reference_type, '') <> 'year_end_close'
       AND coa.account_type::text IN ('revenue', 'expense')
     GROUP BY coa.id, coa.account_type
    HAVING round(SUM(l.debit_amount - l.credit_amount), 2) <> 0
  LOOP
    -- Reverse each balance: a debit balance is credited, a credit balance debited.
    v_lines := v_lines || jsonb_build_object('account_id', a.id,
      'debit', CASE WHEN a.bal < 0 THEN -a.bal ELSE 0 END, 'credit', CASE WHEN a.bal > 0 THEN a.bal ELSE 0 END,
      'description', 'Close to retained earnings');
    v_net := v_net + a.bal;
  END LOOP;

  IF jsonb_array_length(v_lines) > 0 THEN
    -- Profit (net credit) is credited to retained earnings; a loss is debited.
    v_lines := v_lines || jsonb_build_object('account_id', v_re,
      'debit', CASE WHEN v_net > 0 THEN v_net ELSE 0 END, 'credit', CASE WHEN v_net < 0 THEN -v_net ELSE 0 END,
      'description', CASE WHEN v_net < 0 THEN 'Profit for ' ELSE 'Loss for ' END || fy.year_name);
    PERFORM set_config('app.period_override', 'on', true);
    v_je := public.post_system_journal(fy.company_id, fy.end_date, 'year_end_close', fy.id, fy.year_name,
                                       'Year-end close ' || fy.year_name, v_lines);
    PERFORM set_config('app.period_override', 'off', true);
    UPDATE public.journal_entries SET journal_type = 'closing' WHERE id = v_je;
  END IF;

  UPDATE public.accounting_periods SET status = 'locked', updated_at = now()
   WHERE company_id = fy.company_id AND start_date >= fy.start_date AND end_date <= fy.end_date;
  UPDATE public.fiscal_years
     SET status = 'closed', is_current = false, closed_by = auth.uid(), closed_at = now(), closing_journal_id = v_je, updated_at = now()
   WHERE id = fy.id;
  RETURN jsonb_build_object('status', 'closed', 'journal_entry_id', v_je, 'profit', -v_net);
END;
$$;

-- Periods and years change only through these functions.
CREATE OR REPLACE FUNCTION public.guard_periods()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Use New fiscal year, Close and Reopen in Finance › Accounting periods' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_accounting_periods ON public.accounting_periods;
CREATE TRIGGER trg_guard_accounting_periods
  BEFORE INSERT OR UPDATE OR DELETE ON public.accounting_periods
  FOR EACH ROW EXECUTE FUNCTION public.guard_periods();
DROP TRIGGER IF EXISTS trg_guard_fiscal_years ON public.fiscal_years;
CREATE TRIGGER trg_guard_fiscal_years
  BEFORE INSERT OR UPDATE OR DELETE ON public.fiscal_years
  FOR EACH ROW EXECUTE FUNCTION public.guard_periods();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Grants
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.post_stock_to_ledger(uuid)', 'public.stock_ledger_status(uuid)',
    'public.open_fiscal_year(uuid, date, text)', 'public.close_accounting_period(uuid)',
    'public.reopen_accounting_period(uuid, text)', 'public.close_fiscal_year(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.post_stock_to_ledger_core(uuid, date)', 'public.stock_ledger_candidates(uuid, date)',
    'public.run_stock_ledger_posting()', 'public.grni_open_for_invoice(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN ('post_stock_to_ledger', 'stock_ledger_status', 'open_fiscal_year',
--        'close_accounting_period', 'reopen_accounting_period', 'close_fiscal_year')) AS ledger_fns,  -- 6
--     (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_assign_journal_period', 'trg_guard_accounting_periods',
--        'trg_guard_fiscal_years')) AS ledger_triggers,  -- 3
--     (SELECT count(*) FROM cron.job WHERE jobname = 'stock-ledger-hourly') AS stock_job;  -- 1
-- ─────────────────────────────────────────────────────────────────────────────
