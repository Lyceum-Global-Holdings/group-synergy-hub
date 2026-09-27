-- Sourcing: the three open issues from the process atlas.
--
--   1. Contracts now expire and renew by themselves. A nightly job activates
--      approved contracts on their effective date, renews auto-renewing ones
--      for another term (within the renewal limit), expires the rest, and logs
--      a reminder when a contract enters its notice window. Every change is kept
--      in contract_events, which the contract-reminders email function reads.
--   2. Supplier evaluations are filled from approved goods receipts: lateness
--      against the PO due date and each receipt's accepted/rejected split,
--      instead of being typed in by hand.
--   3. PEPPOL e-invoices reach accounts payable. Inbound documents are stored
--      properly (the old ingest could never insert them), matched to their PO
--      and GRN, and every e-invoice from a supplier becomes a supplier invoice
--      awaiting approval, kept in step with its three-way match.
--
-- Safe to run more than once.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Contracts
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS renewal_term_months integer,
  ADD COLUMN IF NOT EXISTS renewal_notice_sent_for date,
  ADD COLUMN IF NOT EXISTS last_renewed_at timestamptz;

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_renewal_term_months_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_renewal_term_months_check
  CHECK (renewal_term_months IS NULL OR renewal_term_months BETWEEN 1 AND 120);

-- Contracts used to be saved with the company from the user's sign-up metadata,
-- which is usually empty, so only admins could see them. Give them the creator's
-- company.
UPDATE public.contracts c
   SET company_id = p.company_id
  FROM public.profiles p
 WHERE c.company_id IS NULL
   AND p.user_id = c.created_by
   AND p.company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('activated', 'renewal_due', 'auto_renewed', 'renewed', 'expired')),
  old_expiry date,
  new_expiry date,
  note text,
  actor uuid,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_events_contract_idx ON public.contract_events (contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contract_events_unsent_idx ON public.contract_events (created_at) WHERE emailed_at IS NULL;

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;
-- Anyone who can see the contract sees its history; only the functions below write.
DROP POLICY IF EXISTS "Contract events follow the contract" ON public.contract_events;
CREATE POLICY "Contract events follow the contract" ON public.contract_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_events.contract_id));
REVOKE ALL ON public.contract_events FROM anon;
GRANT SELECT ON public.contract_events TO authenticated;

-- Length of a contract's term in whole months (at least 1), from its dates.
CREATE OR REPLACE FUNCTION public.contract_term_months(p_effective date, p_expiry date)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT GREATEST(1,
    (extract(year FROM a) * 12 + extract(month FROM a) + CASE WHEN extract(day FROM a) >= 15 THEN 1 ELSE 0 END)::int)
  FROM (SELECT age((p_expiry + 1)::timestamp, p_effective::timestamp) AS a) t
$$;

-- The last day of the next term. Counting from the day after expiry keeps month
-- ends stable: 31 Jan + 1 month → 28/29 Feb, then → 31 Mar.
CREATE OR REPLACE FUNCTION public.contract_extend(p_expiry date, p_months integer)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ((p_expiry + 1) + make_interval(months => p_months) - interval '1 day')::date
$$;

CREATE OR REPLACE FUNCTION public.run_contract_lifecycle(p_today date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c record;
  v_term integer;
  v_new date;
  v_count integer;
  n_activated integer := 0;
  n_renewed integer := 0;
  n_expired integer := 0;
  n_due integer := 0;
BEGIN
  -- Approved contracts start on their effective date.
  FOR c IN
    SELECT id, expiry_date FROM public.contracts
     WHERE status = 'approved' AND effective_date <= p_today
       AND (expiry_date IS NULL OR expiry_date >= p_today)
     FOR UPDATE
  LOOP
    UPDATE public.contracts SET status = 'active', updated_at = now() WHERE id = c.id;
    INSERT INTO public.contract_events (contract_id, event, new_expiry) VALUES (c.id, 'activated', c.expiry_date);
    n_activated := n_activated + 1;
  END LOOP;

  -- Past their expiry: renew automatically, or expire.
  FOR c IN
    SELECT * FROM public.contracts
     WHERE status IN ('approved', 'active', 'renewed')
       AND expiry_date IS NOT NULL AND expiry_date < p_today
     FOR UPDATE
  LOOP
    IF (COALESCE(c.auto_renew, false) OR c.renewal_type = 'auto_renewal')
       AND (c.max_renewal_count IS NULL OR COALESCE(c.renewal_count, 0) < c.max_renewal_count) THEN
      v_term := COALESCE(c.renewal_term_months, public.contract_term_months(c.effective_date, c.expiry_date));
      v_new := c.expiry_date;
      v_count := COALESCE(c.renewal_count, 0);
      -- Catch up if several terms were missed, within the renewal limit.
      LOOP
        v_new := public.contract_extend(v_new, v_term);
        v_count := v_count + 1;
        EXIT WHEN v_new >= p_today OR (c.max_renewal_count IS NOT NULL AND v_count >= c.max_renewal_count);
      END LOOP;

      UPDATE public.contracts
         SET expiry_date = v_new,
             renewal_count = v_count,
             renewal_term_months = v_term,
             renewal_notice_sent_for = NULL,
             last_renewed_at = now(),
             status = CASE WHEN v_new >= p_today THEN 'active'::contract_status ELSE 'expired'::contract_status END,
             updated_at = now()
       WHERE id = c.id;
      INSERT INTO public.contract_events (contract_id, event, old_expiry, new_expiry, note)
      VALUES (c.id, 'auto_renewed', c.expiry_date, v_new,
              format('Renewed for %s month%s (renewal %s%s)', v_term, CASE WHEN v_term = 1 THEN '' ELSE 's' END,
                     v_count, CASE WHEN c.max_renewal_count IS NULL THEN '' ELSE ' of ' || c.max_renewal_count END));
      n_renewed := n_renewed + 1;

      IF v_new < p_today THEN
        INSERT INTO public.contract_events (contract_id, event, old_expiry, note)
        VALUES (c.id, 'expired', v_new, 'Reached its renewal limit');
        n_expired := n_expired + 1;
      END IF;
    ELSE
      UPDATE public.contracts SET status = 'expired', updated_at = now() WHERE id = c.id;
      INSERT INTO public.contract_events (contract_id, event, old_expiry, note)
      VALUES (c.id, 'expired', c.expiry_date,
              CASE WHEN COALESCE(c.auto_renew, false) OR c.renewal_type = 'auto_renewal'
                   THEN 'Reached its renewal limit' END);
      n_expired := n_expired + 1;
    END IF;
  END LOOP;

  -- Entering the notice window: remind the owner once per expiry date.
  FOR c IN
    SELECT * FROM public.contracts
     WHERE status IN ('active', 'renewed')
       AND expiry_date IS NOT NULL AND expiry_date >= p_today
       AND expiry_date - COALESCE(renewal_notice_days, 30) <= p_today
       AND renewal_notice_sent_for IS DISTINCT FROM expiry_date
     FOR UPDATE
  LOOP
    UPDATE public.contracts SET renewal_notice_sent_for = c.expiry_date WHERE id = c.id;
    INSERT INTO public.contract_events (contract_id, event, old_expiry, note)
    VALUES (c.id, 'renewal_due', c.expiry_date,
            CASE
              WHEN (COALESCE(c.auto_renew, false) OR c.renewal_type = 'auto_renewal')
                   AND (c.max_renewal_count IS NULL OR COALESCE(c.renewal_count, 0) < c.max_renewal_count)
                THEN 'Renews automatically unless it is terminated first'
              WHEN c.renewal_type = 'renegotiation_required' THEN 'Needs renegotiation before it expires'
              ELSE 'Needs a renewal decision before it expires'
            END);
    n_due := n_due + 1;
  END LOOP;

  RETURN jsonb_build_object('activated', n_activated, 'renewed', n_renewed, 'expired', n_expired, 'renewal_due', n_due);
END;
$$;

-- A person renews a contract to a new expiry date.
CREATE OR REPLACE FUNCTION public.renew_contract(p_contract_id uuid, p_new_expiry date, p_note text DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.contracts WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND OR (
    public.is_admin(auth.uid())
    OR ((c.created_by = auth.uid() OR c.owner_id = auth.uid())
        AND (c.company_id IS NULL OR public.can_access_company(c.company_id)))
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'You can''t renew this contract' USING ERRCODE = '42501';
  END IF;
  IF c.status NOT IN ('approved', 'active', 'renewed', 'expired') THEN
    RAISE EXCEPTION 'A % contract can''t be renewed', replace(c.status::text, '_', ' ');
  END IF;
  IF c.expiry_date IS NULL THEN
    RAISE EXCEPTION 'This contract has no expiry date, so there is nothing to renew';
  END IF;
  IF p_new_expiry IS NULL OR p_new_expiry <= c.expiry_date THEN
    RAISE EXCEPTION 'The new expiry date must be after %', to_char(c.expiry_date, 'DD Mon YYYY');
  END IF;
  IF p_new_expiry < CURRENT_DATE THEN
    RAISE EXCEPTION 'The new expiry date is already in the past';
  END IF;

  UPDATE public.contracts
     SET expiry_date = p_new_expiry,
         status = CASE WHEN effective_date <= CURRENT_DATE THEN 'active'::contract_status ELSE status END,
         renewal_count = COALESCE(renewal_count, 0) + 1,
         renewal_notice_sent_for = NULL,
         last_renewed_at = now(),
         updated_at = now()
   WHERE id = p_contract_id;

  INSERT INTO public.contract_events (contract_id, event, old_expiry, new_expiry, note, actor)
  VALUES (p_contract_id, 'renewed', c.expiry_date, p_new_expiry, NULLIF(btrim(p_note), ''), auth.uid());

  RETURN p_new_expiry;
END;
$$;

REVOKE ALL ON FUNCTION public.run_contract_lifecycle(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_contract(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_contract(uuid, date, text) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Supplier evaluations from goods receipts
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.supplier_evaluation_entries
  ADD COLUMN IF NOT EXISTS grn_id uuid REFERENCES public.goods_receipt_notes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.supplier_evaluation_entries DROP CONSTRAINT IF EXISTS supplier_evaluation_entries_source_check;
ALTER TABLE public.supplier_evaluation_entries
  ADD CONSTRAINT supplier_evaluation_entries_source_check CHECK (source IN ('manual', 'grn'));
CREATE UNIQUE INDEX IF NOT EXISTS supplier_evaluation_entries_grn_key
  ON public.supplier_evaluation_entries (evaluation_id, grn_id) WHERE grn_id IS NOT NULL;

-- Entries were visible only to the evaluation's creator and admins, so everyone
-- else saw an evaluation with no deliveries. Follow the evaluation instead.
DROP POLICY IF EXISTS "Users can view evaluation entries they have access to" ON public.supplier_evaluation_entries;
CREATE POLICY "Users can view evaluation entries they have access to" ON public.supplier_evaluation_entries
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.supplier_evaluations se WHERE se.id = supplier_evaluation_entries.evaluation_id));

-- Same formula as the Supplier Evaluation screen: average performance → 0–5 stars.
CREATE OR REPLACE FUNCTION public.refresh_supplier_rating(p_supplier_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.suppliers
     SET rating = (SELECT round(avg(performance_rate) / 100 * 5, 2)
                     FROM public.supplier_evaluations WHERE supplier_id = p_supplier_id)
   WHERE id = p_supplier_id;
$$;

-- One entry per approved goods receipt in the evaluation's period (only lines of
-- the evaluated item, when there is one). Receipts already added are skipped.
--   Punctuality: receipt date against the PO line's delivery date, else the PO's
--     expected date. On time = 50, 1–5 days late = 30, 6–14 = 20, later = 0.
--     No due date on the PO counts as on time.
--   Quality: everything accepted = passed first time (50); some rejected or
--     damaged goods accepted = failed but accepted (20); nothing accepted =
--     failed and returned (0). "Passed after rework" can't be seen on a GRN, so
--     that stays a manual correction.
CREATE OR REPLACE FUNCTION public.evaluation_fill_from_grns(p_evaluation_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v public.supplier_evaluations%ROWTYPE;
  v_added integer;
BEGIN
  SELECT * INTO v FROM public.supplier_evaluations WHERE id = p_evaluation_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  INSERT INTO public.supplier_evaluation_entries (
    evaluation_id, grn_id, source, receipt_date, po_delivery_date, po_number, warehouse_item_id,
    passed_first_time, passed_after_rework, failed_but_accepted, failed_returned,
    within_due_date, five_days_late, within_14_days, over_14_days_late, notes
  )
  SELECT v.id, d.grn_id, 'grn', d.grn_date, COALESCE(d.due_date, d.grn_date), d.po_number, v.warehouse_item_id,
         d.accepted > 0 AND d.rejected = 0 AND d.all_good,
         false,
         d.accepted > 0 AND NOT (d.rejected = 0 AND d.all_good),
         d.accepted = 0,
         d.days_late IS NULL OR d.days_late <= 0,
         d.days_late BETWEEN 1 AND 5,
         d.days_late BETWEEN 6 AND 14,
         d.days_late > 14,
         concat_ws(' · ',
           d.grn_number,
           CASE
             WHEN d.days_late IS NULL THEN 'no due date on the PO, counted as on time'
             WHEN d.days_late <= 0 THEN 'on time'
             WHEN d.days_late = 1 THEN '1 day late'
             ELSE d.days_late || ' days late'
           END,
           CASE
             WHEN d.accepted = 0 THEN 'all rejected'
             WHEN d.rejected > 0 THEN trim_scale(d.rejected) || ' of ' || trim_scale(d.accepted + d.rejected) || ' rejected'
             WHEN NOT d.all_good THEN 'damaged goods accepted'
             ELSE 'all accepted'
           END)
    FROM (
      SELECT g.id AS grn_id, g.grn_number, g.grn_date,
             COALESCE(g.po_number, po.po_number) AS po_number,
             g.grn_date - min(COALESCE(pi.delivery_date, po.expected_delivery_date)) AS days_late,
             min(COALESCE(pi.delivery_date, po.expected_delivery_date)) AS due_date,
             sum(COALESCE(gi.quantity_accepted, 0)) AS accepted,
             sum(COALESCE(gi.quantity_rejected, 0)) AS rejected,
             bool_and(COALESCE(gi.quality_status, 'good') = 'good') AS all_good
        FROM public.goods_receipt_notes g
        JOIN public.grn_items gi ON gi.grn_id = g.id AND COALESCE(gi.quantity_received, 0) > 0
        LEFT JOIN public.purchase_orders po ON po.id = g.po_id
        LEFT JOIN public.po_items pi ON pi.id = gi.po_item_id
       WHERE g.supplier_id = v.supplier_id
         AND g.status IN ('approved', 'completed')
         AND g.grn_date BETWEEN v.evaluation_period_start AND v.evaluation_period_end
         AND (CASE WHEN v.company_id IS NULL THEN public.can_access_company(g.company_id) ELSE g.company_id = v.company_id END)
         AND (v.warehouse_item_id IS NULL OR gi.warehouse_item_id = v.warehouse_item_id)
       GROUP BY g.id, g.grn_number, g.grn_date, g.po_number, po.po_number
    ) d
  ON CONFLICT (evaluation_id, grn_id) WHERE grn_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_added = ROW_COUNT;
  IF v_added > 0 THEN
    PERFORM public.refresh_supplier_rating(v.supplier_id);
  END IF;
  RETURN v_added;
END;
$$;

-- "Pull deliveries from goods receipts" on one evaluation.
CREATE OR REPLACE FUNCTION public.populate_evaluation_from_deliveries(p_evaluation_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v public.supplier_evaluations%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.supplier_evaluations WHERE id = p_evaluation_id;
  IF NOT FOUND OR (
    public.is_admin(auth.uid())
    OR (v.created_by = auth.uid() AND (v.company_id IS NULL OR public.can_access_company(v.company_id)))
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'You can''t change this evaluation' USING ERRCODE = '42501';
  END IF;
  IF v.status <> 'draft' THEN
    RAISE EXCEPTION 'This evaluation is %; only draft evaluations take new deliveries', v.status;
  END IF;
  RETURN public.evaluation_fill_from_grns(p_evaluation_id);
END;
$$;

-- "Evaluate all suppliers": one evaluation per supplier that delivered in the
-- period, built from its receipts. A draft evaluation for exactly that supplier
-- and period is topped up instead of duplicated.
CREATE OR REPLACE FUNCTION public.generate_supplier_evaluations(p_company_id uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s record;
  v_existing public.supplier_evaluations%ROWTYPE;
  v_id uuid;
  n_created integer := 0;
  n_updated integer := 0;
  n_skipped integer := 0;
  n_deliveries integer := 0;
  v_added integer;
BEGIN
  IF p_company_id IS NULL OR public.can_access_company(p_company_id) IS NOT TRUE
     OR (public.has_procurement_access(auth.uid()) OR public.is_admin(auth.uid())) IS NOT TRUE THEN
    RAISE EXCEPTION 'You can''t evaluate suppliers for this company' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Choose a period that ends after it starts';
  END IF;
  IF p_to - p_from > 366 THEN
    RAISE EXCEPTION 'Choose a period of a year or less';
  END IF;

  FOR s IN
    SELECT DISTINCT g.supplier_id
      FROM public.goods_receipt_notes g
     WHERE g.company_id = p_company_id AND g.supplier_id IS NOT NULL
       AND g.status IN ('approved', 'completed')
       AND g.grn_date BETWEEN p_from AND p_to
  LOOP
    SELECT * INTO v_existing FROM public.supplier_evaluations
     WHERE supplier_id = s.supplier_id AND company_id = p_company_id AND warehouse_item_id IS NULL
       AND evaluation_period_start = p_from AND evaluation_period_end = p_to
     ORDER BY created_at DESC LIMIT 1;

    IF FOUND THEN
      IF v_existing.status <> 'draft' THEN
        n_skipped := n_skipped + 1;
        CONTINUE;
      END IF;
      v_added := public.evaluation_fill_from_grns(v_existing.id);
      IF v_added > 0 THEN n_updated := n_updated + 1; END IF;
    ELSE
      INSERT INTO public.supplier_evaluations (
        evaluation_number, supplier_id, product_name, evaluation_period_start, evaluation_period_end,
        status, company_id, created_by, evaluated_by
      ) VALUES ('', s.supplier_id, 'All deliveries', p_from, p_to, 'draft', p_company_id, auth.uid(), auth.uid())
      RETURNING id INTO v_id;
      v_added := public.evaluation_fill_from_grns(v_id);
      n_created := n_created + 1;
    END IF;
    n_deliveries := n_deliveries + v_added;
  END LOOP;

  RETURN jsonb_build_object('created', n_created, 'updated', n_updated, 'skipped', n_skipped, 'deliveries', n_deliveries);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_supplier_rating(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluation_fill_from_grns(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.populate_evaluation_from_deliveries(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_supplier_evaluations(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.populate_evaluation_from_deliveries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_supplier_evaluations(uuid, date, date) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. E-invoices → accounts payable
-- ═════════════════════════════════════════════════════════════════════════════

-- Inbound documents arrive from the network, not from a user.
ALTER TABLE public.einvoices ALTER COLUMN created_by DROP NOT NULL;

-- Invoice numbers are only unique per supplier: two suppliers can both send
-- "INV-001" to the same company.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'public.einvoices'::regclass AND con.contype = 'u'
       AND (SELECT array_agg(att.attname::text ORDER BY att.attname)
              FROM pg_attribute att
             WHERE att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey))
           = ARRAY['company_id', 'direction', 'invoice_number']
  LOOP
    EXECUTE format('ALTER TABLE public.einvoices DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS einvoices_company_direction_supplier_number_key
  ON public.einvoices (company_id, direction, supplier_id, invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS einvoices_peppol_message_key
  ON public.einvoices (peppol_message_id) WHERE direction = 'inbound' AND peppol_message_id IS NOT NULL;

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS einvoice_id uuid REFERENCES public.einvoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_source_check;
ALTER TABLE public.supplier_invoices
  ADD CONSTRAINT supplier_invoices_source_check CHECK (source IN ('manual', 'portal', 'peppol'));
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_einvoice_key
  ON public.supplier_invoices (einvoice_id) WHERE einvoice_id IS NOT NULL;

-- Invoices suppliers already submitted through the portal.
UPDATE public.supplier_invoices si
   SET source = 'portal'
 WHERE si.source = 'manual'
   AND EXISTS (SELECT 1 FROM public.supplier_users su WHERE su.user_id = si.created_by AND su.supplier_id = si.supplier_id);

-- The company or supplier registered under a PEPPOL participant ID. Accepts
-- "0088:5790000435968" or the ID and scheme separately.
CREATE OR REPLACE FUNCTION public.peppol_owner(p_owner_type text, p_scheme text, p_id text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT owner_id FROM public.peppol_participants
   WHERE owner_type = p_owner_type
     AND NULLIF(btrim(p_id), '') IS NOT NULL
     AND (lower(participant_id) = lower(btrim(p_id))
          OR lower(scheme_id || ':' || participant_id) = lower(btrim(p_id))
          OR (p_scheme IS NOT NULL AND lower(participant_id) = lower(btrim(p_scheme) || ':' || btrim(p_id))))
   ORDER BY is_primary DESC, verified_at DESC NULLS LAST
   LIMIT 1
$$;

-- Create or refresh the supplier invoice for an e-invoice from a supplier:
--   inbound over PEPPOL (unless rejected or cancelled), or sent from the supplier
--   portal to one of our companies. Matching portal-submitted invoices are
--   linked rather than duplicated. Once finance has approved an invoice only
--   its match status is updated.
CREATE OR REPLACE FUNCTION public.sync_einvoice_to_ap(p_einvoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  e public.einvoices%ROWTYPE;
  v_company uuid;
  v_sign numeric;
  v_match text;
  v_ap public.supplier_invoices%ROWTYPE;
  v_notes text;
  v_seller text;
BEGIN
  SELECT * INTO e FROM public.einvoices WHERE id = p_einvoice_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF e.direction = 'inbound' THEN
    IF e.status IN ('rejected', 'cancelled', 'draft') THEN
      -- Rejected by us before finance approved it: withdraw it from payables.
      UPDATE public.supplier_invoices SET status = 'cancelled', updated_at = now()
       WHERE einvoice_id = e.id AND source = 'peppol' AND status IN ('draft', 'pending_approval');
      RETURN NULL;
    END IF;
    v_company := e.company_id;
  ELSE
    IF e.supplier_id IS NULL OR e.status NOT IN ('sent', 'delivered', 'accepted') THEN RETURN NULL; END IF;
    v_company := COALESCE(e.customer_company_id, e.company_id);
  END IF;
  IF v_company IS NULL THEN RETURN NULL; END IF;

  v_sign := CASE WHEN e.document_type = 'credit_note' THEN -1 ELSE 1 END;
  v_match := CASE e.match_status
               WHEN 'matched' THEN 'matched'
               WHEN 'partial' THEN 'partial'
               WHEN 'discrepancy' THEN 'mismatch'
               ELSE 'pending'
             END;
  v_seller := concat_ws(' ', e.validation_report->'seller'->>'name',
                        '(' || NULLIF(e.validation_report->'seller'->>'endpoint_id', '') || ')');
  v_notes := concat_ws('. ',
    CASE WHEN e.direction = 'inbound' THEN 'Received over PEPPOL' ELSE 'Sent as an e-invoice from the supplier portal' END
      || CASE WHEN e.document_type = 'credit_note' THEN ' as a credit note' ELSE '' END,
    CASE WHEN e.supplier_id IS NULL THEN 'Supplier not recognised: ' || COALESCE(NULLIF(v_seller, ''), 'no seller details') END,
    NULLIF(btrim(e.notes), ''));

  SELECT * INTO v_ap FROM public.supplier_invoices WHERE einvoice_id = e.id;
  IF NOT FOUND AND e.supplier_id IS NOT NULL THEN
    SELECT * INTO v_ap FROM public.supplier_invoices
     WHERE company_id = v_company AND supplier_id = e.supplier_id
       AND lower(btrim(invoice_number)) = lower(btrim(e.invoice_number))
       AND status <> 'cancelled' AND einvoice_id IS NULL
     ORDER BY created_at LIMIT 1;
    IF FOUND THEN
      UPDATE public.supplier_invoices SET einvoice_id = e.id WHERE id = v_ap.id;
    END IF;
  END IF;

  IF v_ap.id IS NULL THEN
    INSERT INTO public.supplier_invoices (
      company_id, supplier_id, po_id, grn_id, invoice_number, invoice_date, due_date, currency,
      net_amount, tax_amount, gross_amount, amount_paid, status, three_way_match_status,
      notes, source, einvoice_id
    ) VALUES (
      v_company, e.supplier_id, e.po_id, e.grn_id, e.invoice_number, e.issue_date,
      COALESCE(e.due_date, e.issue_date + 30), e.currency,
      v_sign * e.subtotal, v_sign * e.tax_total, v_sign * e.grand_total, 0, 'pending_approval', v_match,
      v_notes, 'peppol', e.id
    ) RETURNING * INTO v_ap;

    INSERT INTO public.supplier_invoice_lines (invoice_id, line_number, description, quantity, unit_price, amount, tax_amount)
    SELECT v_ap.id, l.line_no, l.description, l.quantity, l.unit_price, v_sign * l.line_extension, v_sign * l.tax_amount
      FROM public.einvoice_lines l WHERE l.einvoice_id = e.id ORDER BY l.line_no;

    INSERT INTO public.einvoice_events (einvoice_id, event_type, payload)
    VALUES (e.id, 'updated', jsonb_build_object('action', 'sent_to_payables', 'supplier_invoice_id', v_ap.id));
    RETURN v_ap.id;
  END IF;

  IF v_ap.source = 'peppol' AND v_ap.status IN ('draft', 'pending_approval') THEN
    UPDATE public.supplier_invoices
       SET supplier_id = e.supplier_id, po_id = e.po_id, grn_id = e.grn_id,
           invoice_number = e.invoice_number, invoice_date = e.issue_date,
           due_date = COALESCE(e.due_date, e.issue_date + 30), currency = e.currency,
           net_amount = v_sign * e.subtotal, tax_amount = v_sign * e.tax_total, gross_amount = v_sign * e.grand_total,
           three_way_match_status = v_match, notes = v_notes, updated_at = now()
     WHERE id = v_ap.id;
    DELETE FROM public.supplier_invoice_lines WHERE invoice_id = v_ap.id;
    INSERT INTO public.supplier_invoice_lines (invoice_id, line_number, description, quantity, unit_price, amount, tax_amount)
    SELECT v_ap.id, l.line_no, l.description, l.quantity, l.unit_price, v_sign * l.line_extension, v_sign * l.tax_amount
      FROM public.einvoice_lines l WHERE l.einvoice_id = e.id ORDER BY l.line_no;
  ELSE
    UPDATE public.supplier_invoices
       SET three_way_match_status = v_match,
           po_id = COALESCE(po_id, e.po_id),
           grn_id = COALESCE(grn_id, e.grn_id),
           updated_at = now()
     WHERE id = v_ap.id;
  END IF;
  RETURN v_ap.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_einvoice_to_ap()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_einvoice_to_ap(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_einvoice_to_ap ON public.einvoices;
CREATE TRIGGER trg_einvoice_to_ap
  AFTER UPDATE OF status, match_status, po_id, grn_id, supplier_id, company_id, customer_company_id ON public.einvoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_einvoice_to_ap();

-- Store an inbound PEPPOL document (called by peppol-ingest-inbound with the
-- service role). Resolves our company and the supplier from their PEPPOL IDs
-- (the supplier falls back to its tax number), the PO from the order reference,
-- and the latest approved GRN for that PO, then sends it to payables. Returns
-- the e-invoice id; a repeated webhook for the same message returns the same id.
CREATE OR REPLACE FUNCTION public.record_inbound_einvoice(p_doc jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_company uuid;
  v_supplier uuid;
  v_po public.purchase_orders%ROWTYPE;
  v_grn uuid;
  v_ref text;
  v_number text := NULLIF(btrim(p_doc->>'invoice_number'), '');
  v_issue date := NULLIF(p_doc->>'issue_date', '')::date;
  v_type public.einvoice_document_type :=
    CASE WHEN p_doc->>'document_type' = 'credit_note' THEN 'credit_note' ELSE 'invoice' END;
  v_line jsonb;
  v_n integer := 0;
BEGIN
  IF NULLIF(p_doc->>'message_id', '') IS NOT NULL THEN
    SELECT id INTO v_id FROM public.einvoices
     WHERE direction = 'inbound' AND peppol_message_id = p_doc->>'message_id';
    IF FOUND THEN RETURN v_id; END IF;
  END IF;
  IF v_number IS NULL THEN RAISE EXCEPTION 'The e-invoice has no invoice number'; END IF;
  IF v_issue IS NULL THEN RAISE EXCEPTION 'The e-invoice has no issue date'; END IF;

  v_company := public.peppol_owner('company', p_doc->'buyer'->>'endpoint_scheme', p_doc->'buyer'->>'endpoint_id');
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No company is registered for PEPPOL ID %', COALESCE(p_doc->'buyer'->>'endpoint_id', '(none)');
  END IF;

  v_supplier := public.peppol_owner('supplier', p_doc->'seller'->>'endpoint_scheme', p_doc->'seller'->>'endpoint_id');
  IF v_supplier IS NULL AND NULLIF(btrim(p_doc->'seller'->>'tax_id'), '') IS NOT NULL THEN
    SELECT CASE WHEN count(*) = 1 THEN min(id::text)::uuid END INTO v_supplier
      FROM public.suppliers
     WHERE lower(btrim(tax_id)) = lower(btrim(p_doc->'seller'->>'tax_id'));
  END IF;

  FOREACH v_ref IN ARRAY ARRAY[NULLIF(btrim(p_doc->>'order_reference'), ''), NULLIF(btrim(p_doc->>'buyer_reference'), '')] LOOP
    CONTINUE WHEN v_ref IS NULL;
    SELECT * INTO v_po FROM public.purchase_orders
     WHERE company_id = v_company AND lower(po_number) = lower(v_ref)
       AND (v_supplier IS NULL OR supplier_id = v_supplier)
     LIMIT 1;
    EXIT WHEN FOUND;
  END LOOP;
  IF v_po.id IS NOT NULL THEN
    v_supplier := COALESCE(v_supplier, v_po.supplier_id);
    SELECT g.id INTO v_grn FROM public.goods_receipt_notes g
     WHERE g.po_id = v_po.id AND g.status IN ('approved', 'completed')
     ORDER BY g.approved_date DESC NULLS LAST, g.created_at DESC LIMIT 1;
  END IF;

  INSERT INTO public.einvoices (
    company_id, direction, document_type, supplier_id, customer_company_id, invoice_number, issue_date, due_date,
    currency, subtotal, tax_total, grand_total, status, match_status, peppol_message_id,
    peppol_profile, peppol_customization, ubl_xml_path, po_id, grn_id, notes, validation_report
  ) VALUES (
    v_company, 'inbound', v_type, v_supplier, v_company, v_number, v_issue, NULLIF(p_doc->>'due_date', '')::date,
    COALESCE(NULLIF(upper(btrim(p_doc->>'currency')), ''), 'LKR'),
    COALESCE(NULLIF(p_doc->>'subtotal', '')::numeric, 0),
    COALESCE(NULLIF(p_doc->>'tax_total', '')::numeric, 0),
    COALESCE(NULLIF(p_doc->>'grand_total', '')::numeric, 0),
    'received', 'unmatched', NULLIF(p_doc->>'message_id', ''),
    COALESCE(NULLIF(p_doc->>'profile_id', ''), 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'),
    COALESCE(NULLIF(p_doc->>'customization_id', ''), 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0'),
    NULLIF(p_doc->>'xml_path', ''), v_po.id, v_grn, NULLIF(btrim(p_doc->>'note'), ''),
    jsonb_build_object(
      'source', 'peppol_inbound',
      'seller', p_doc->'seller',
      'buyer', p_doc->'buyer',
      'order_reference', p_doc->>'order_reference',
      'buyer_reference', p_doc->>'buyer_reference',
      'lines', jsonb_array_length(COALESCE(p_doc->'lines', '[]'::jsonb)))
  ) RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_doc->'lines', '[]'::jsonb)) LOOP
    v_n := v_n + 1;
    INSERT INTO public.einvoice_lines (
      einvoice_id, line_no, item_code, description, quantity, unit, unit_price, line_extension,
      tax_category, tax_rate, tax_amount, po_line_id
    ) VALUES (
      v_id,
      COALESCE(NULLIF(v_line->>'line_no', '')::integer, v_n),
      NULLIF(btrim(v_line->>'item_code'), ''),
      COALESCE(NULLIF(btrim(v_line->>'description'), ''), NULLIF(btrim(v_line->>'item_code'), ''), 'Line ' || v_n),
      COALESCE(NULLIF(v_line->>'quantity', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'unit', ''), 'EA'),
      COALESCE(NULLIF(v_line->>'unit_price', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'line_extension', '')::numeric,
               COALESCE(NULLIF(v_line->>'quantity', '')::numeric, 0) * COALESCE(NULLIF(v_line->>'unit_price', '')::numeric, 0)),
      COALESCE(NULLIF(v_line->>'tax_category', ''), 'S'),
      COALESCE(NULLIF(v_line->>'tax_rate', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'tax_amount', '')::numeric, 0),
      (SELECT pi.id FROM public.po_items pi
        WHERE pi.po_id = v_po.id AND NULLIF(btrim(v_line->>'item_code'), '') IS NOT NULL
          AND lower(pi.item_code) = lower(btrim(v_line->>'item_code'))
        LIMIT 1)
    );
  END LOOP;

  INSERT INTO public.einvoice_events (einvoice_id, event_type, payload)
  VALUES (v_id, 'created', jsonb_build_object('source', 'peppol_inbound', 'provider_message_id', p_doc->>'message_id'));

  PERFORM public.sync_einvoice_to_ap(v_id);
  RETURN v_id;
END;
$$;

-- Portal invoices keep the same rules as before and are now labelled as such.
CREATE OR REPLACE FUNCTION public.submit_supplier_invoice(
  p_po_id uuid,
  p_invoice_number text,
  p_invoice_date date,
  p_due_date date,
  p_lines jsonb,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_invoice_id uuid;
  v_grn_id uuid;
  v_line jsonb;
  v_qty numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_n integer := 0;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
  IF NOT FOUND OR NOT public.can_act_for_supplier(v_po.supplier_id) THEN
    RAISE EXCEPTION 'You can''t invoice this purchase order' USING ERRCODE = '42501';
  END IF;
  IF v_po.status NOT IN ('sent', 'acknowledged', 'partially_received', 'completed') THEN
    RAISE EXCEPTION 'This purchase order can''t be invoiced yet';
  END IF;
  IF NULLIF(btrim(p_invoice_number), '') IS NULL THEN RAISE EXCEPTION 'Enter your invoice number'; END IF;
  IF p_invoice_date IS NULL THEN RAISE EXCEPTION 'Enter the invoice date'; END IF;
  IF p_due_date IS NOT NULL AND p_due_date < p_invoice_date THEN
    RAISE EXCEPTION 'The due date can''t be before the invoice date';
  END IF;
  IF COALESCE(p_tax_amount, 0) < 0 THEN RAISE EXCEPTION 'Tax can''t be negative'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.supplier_invoices
     WHERE supplier_id = v_po.supplier_id
       AND lower(btrim(invoice_number)) = lower(btrim(p_invoice_number))
       AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Invoice % has already been submitted', btrim(p_invoice_number);
  END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one invoice line';
  END IF;

  SELECT g.id INTO v_grn_id FROM public.goods_receipt_notes g
   WHERE g.po_id = p_po_id AND g.status = 'approved'
   ORDER BY g.approved_date DESC NULLS LAST LIMIT 1;

  INSERT INTO public.supplier_invoices (
    company_id, supplier_id, po_id, grn_id, invoice_number, invoice_date, due_date, currency,
    gross_amount, tax_amount, net_amount, amount_paid, payment_terms, status,
    three_way_match_status, notes, created_by, source
  ) VALUES (
    v_po.company_id, v_po.supplier_id, p_po_id, v_grn_id, btrim(p_invoice_number), p_invoice_date,
    COALESCE(p_due_date, p_invoice_date + 30), COALESCE(v_po.currency, 'LKR'),
    0, COALESCE(p_tax_amount, 0), 0, 0, v_po.payment_terms, 'pending_approval',
    'pending', COALESCE(NULLIF(btrim(p_notes), ''), 'Submitted by the supplier through the portal'), auth.uid(), 'portal'
  ) RETURNING id INTO v_invoice_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty := NULLIF(v_line->>'quantity', '')::numeric;
    v_price := NULLIF(v_line->>'unit_price', '')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 OR v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'Each line needs a quantity above zero and a price';
    END IF;
    v_n := v_n + 1;
    INSERT INTO public.supplier_invoice_lines (invoice_id, line_number, description, quantity, unit_price, amount, tax_amount)
    VALUES (v_invoice_id, v_n, NULLIF(btrim(v_line->>'description'), ''), v_qty, v_price, v_qty * v_price, 0);
    v_subtotal := v_subtotal + v_qty * v_price;
  END LOOP;

  UPDATE public.supplier_invoices
     SET net_amount = v_subtotal,
         gross_amount = v_subtotal + COALESCE(p_tax_amount, 0)
   WHERE id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.peppol_owner(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_einvoice_to_ap(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_einvoice_to_ap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_inbound_einvoice(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_supplier_invoice(uuid, text, date, date, jsonb, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_supplier_invoice(uuid, text, date, date, jsonb, numeric, text) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.record_inbound_einvoice(jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION public.sync_einvoice_to_ap(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.run_contract_lifecycle(date) TO service_role;
  END IF;
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Nightly jobs (06:00 and 06:15 Sri Lanka time)
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('contract-lifecycle-daily', 'contract-reminders-daily');
    PERFORM cron.schedule('contract-lifecycle-daily', '30 0 * * *', $job$ SELECT public.run_contract_lifecycle(); $job$);
    PERFORM cron.schedule('contract-reminders-daily', '45 0 * * *', $job$
      SELECT net.http_post(
        url := 'https://ajsyvuozkgcnnvvefeed.supabase.co/functions/v1/contract-reminders',
        headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqc3l2dW96a2djbm52dmVmZWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNzg1NzYsImV4cCI6MjA3Mzc1NDU3Nn0.FlmuH3bEof12Bjetv-_3hKY13elsE6smhR4ie3imePA"}'::jsonb,
        body := '{}'::jsonb
      );
    $job$);
  END IF;
END $$;

-- Bring contracts up to date now rather than waiting for tonight. Contracts
-- that ran out more than a month ago are recorded but not emailed about.
SELECT public.run_contract_lifecycle();
UPDATE public.contract_events
   SET emailed_at = now()
 WHERE emailed_at IS NULL AND event = 'expired' AND old_expiry < CURRENT_DATE - 30;

-- ─────────────────────────────────────────────────────────────────────────────
-- Checks after running (read-only):
--   SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'contract-%';
--   SELECT status, count(*) FROM contracts GROUP BY 1;
--   SELECT event, count(*) FROM contract_events GROUP BY 1;
--   SELECT source, count(*) FROM supplier_invoices GROUP BY 1;
-- ─────────────────────────────────────────────────────────────────────────────
