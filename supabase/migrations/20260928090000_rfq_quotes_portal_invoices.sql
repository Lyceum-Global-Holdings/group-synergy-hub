-- RFQs end to end, supplier quotes and invoices through the portal.
--
-- The RFQ tables existed but only "create" and "publish" worked: nobody could
-- invite suppliers, suppliers could not see RFQs or submit quotes, and there was
-- no comparison, award or conversion to a PO. Suppliers also could not submit
-- invoices. This adds:
--   • read access for supplier-portal members to the RFQs they are invited to,
--     their own quotes, the purchase orders sent to them and their invoices;
--   • checked functions for the workflow steps: invite, publish / close /
--     cancel, submit a quote (supplier or buyer on their behalf), award (with an
--     optional draft PO), and submit an invoice against a PO into accounts
--     payable (feeding the three-way match through po_id / grn_id).
-- Writes go through SECURITY DEFINER functions with explicit checks, because
-- the table policies only let an RFQ's creator edit it while in draft.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helpers (SECURITY DEFINER so policies don't recurse between tables)
-- ─────────────────────────────────────────────────────────────────────────────

-- The caller can manage this RFQ: procurement (or admin) in its company.
CREATE OR REPLACE FUNCTION public.can_manage_rfq(_request_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rfq_rfp_requests r
    WHERE r.id = _request_id
      AND public.can_access_company(r.company_id)
      AND (public.has_procurement_access(auth.uid()) OR public.is_admin(auth.uid()))
  )
$$;

-- The caller belongs to a supplier invited to this RFQ, and it has been issued.
CREATE OR REPLACE FUNCTION public.rfq_visible_to_supplier(_request_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rfq_rfp_requests r
    JOIN public.rfq_rfp_invited_suppliers i ON i.request_id = r.id
    JOIN public.supplier_users su ON su.supplier_id = i.supplier_id
    WHERE r.id = _request_id
      AND r.status <> 'draft'
      AND su.user_id = auth.uid()
      AND su.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.quote_visible_to_supplier(_quote_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_quotes q
    WHERE q.id = _quote_id AND public.is_supplier_member(q.supplier_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.po_visible_to_supplier(_po_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = _po_id
      AND po.status IN ('sent', 'acknowledged', 'partially_received', 'completed')
      AND public.is_supplier_member(po.supplier_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.invoice_visible_to_supplier(_invoice_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_invoices si
    WHERE si.id = _invoice_id AND public.is_supplier_member(si.supplier_id)
  )
$$;

-- Portal members who may act (viewers can only look).
CREATE OR REPLACE FUNCTION public.can_act_for_supplier(_supplier_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_users su
    WHERE su.supplier_id = _supplier_id
      AND su.user_id = auth.uid()
      AND su.is_active
      AND su.portal_role IN ('owner', 'admin', 'user')
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Supplier-portal read access
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Invited suppliers can view their RFQs" ON public.rfq_rfp_requests;
CREATE POLICY "Invited suppliers can view their RFQs" ON public.rfq_rfp_requests
  FOR SELECT TO authenticated USING (public.rfq_visible_to_supplier(id));

DROP POLICY IF EXISTS "Invited suppliers can view RFQ items" ON public.rfq_rfp_items;
CREATE POLICY "Invited suppliers can view RFQ items" ON public.rfq_rfp_items
  FOR SELECT TO authenticated USING (public.rfq_visible_to_supplier(request_id));

DROP POLICY IF EXISTS "Suppliers can view their invitations" ON public.rfq_rfp_invited_suppliers;
CREATE POLICY "Suppliers can view their invitations" ON public.rfq_rfp_invited_suppliers
  FOR SELECT TO authenticated USING (public.is_supplier_member(supplier_id));

DROP POLICY IF EXISTS "Suppliers can view their quotes" ON public.supplier_quotes;
CREATE POLICY "Suppliers can view their quotes" ON public.supplier_quotes
  FOR SELECT TO authenticated USING (public.is_supplier_member(supplier_id));

DROP POLICY IF EXISTS "Suppliers can view their quote items" ON public.supplier_quote_items;
CREATE POLICY "Suppliers can view their quote items" ON public.supplier_quote_items
  FOR SELECT TO authenticated USING (public.quote_visible_to_supplier(quote_id));

DROP POLICY IF EXISTS "Suppliers can view purchase orders sent to them" ON public.purchase_orders;
CREATE POLICY "Suppliers can view purchase orders sent to them" ON public.purchase_orders
  FOR SELECT TO authenticated USING (public.po_visible_to_supplier(id));

DROP POLICY IF EXISTS "Suppliers can view lines of their purchase orders" ON public.po_items;
CREATE POLICY "Suppliers can view lines of their purchase orders" ON public.po_items
  FOR SELECT TO authenticated USING (public.po_visible_to_supplier(po_id));

DROP POLICY IF EXISTS "Suppliers can view their invoices" ON public.supplier_invoices;
CREATE POLICY "Suppliers can view their invoices" ON public.supplier_invoices
  FOR SELECT TO authenticated USING (public.is_supplier_member(supplier_id));

DROP POLICY IF EXISTS "Suppliers can view their invoice lines" ON public.supplier_invoice_lines;
CREATE POLICY "Suppliers can view their invoice lines" ON public.supplier_invoice_lines
  FOR SELECT TO authenticated USING (public.invoice_visible_to_supplier(invoice_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RFQ workflow
-- ─────────────────────────────────────────────────────────────────────────────

-- Invite suppliers (must be approved for the RFQ's company; the blacklist
-- trigger refuses blacklisted ones). Returns how many were newly invited.
CREATE OR REPLACE FUNCTION public.rfq_invite_suppliers(p_request_id uuid, p_supplier_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req public.rfq_rfp_requests%ROWTYPE;
  v_supplier uuid;
  v_name text;
  v_added integer := 0;
BEGIN
  IF NOT public.can_manage_rfq(p_request_id) THEN
    RAISE EXCEPTION 'You can''t manage this RFQ' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_req FROM public.rfq_rfp_requests WHERE id = p_request_id;
  IF v_req.status NOT IN ('draft', 'published', 'in_progress') THEN
    RAISE EXCEPTION 'Suppliers can only be invited before submissions close';
  END IF;

  FOREACH v_supplier IN ARRAY COALESCE(p_supplier_ids, ARRAY[]::uuid[]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.company_suppliers cs
      WHERE cs.company_id = v_req.company_id AND cs.supplier_id = v_supplier AND cs.status = 'approved'
    ) THEN
      SELECT name INTO v_name FROM public.suppliers WHERE id = v_supplier;
      RAISE EXCEPTION '% is not an approved supplier for this company', COALESCE(v_name, 'This supplier');
    END IF;

    INSERT INTO public.rfq_rfp_invited_suppliers (request_id, supplier_id, invitation_date, invitation_status)
    VALUES (p_request_id, v_supplier, now(), 'invited')
    ON CONFLICT (request_id, supplier_id) DO NOTHING;
    IF FOUND THEN v_added := v_added + 1; END IF;
  END LOOP;

  RETURN v_added;
END;
$$;

-- Remove an invitation that has no quote yet.
CREATE OR REPLACE FUNCTION public.rfq_remove_invitation(p_request_id uuid, p_supplier_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_rfq(p_request_id) THEN
    RAISE EXCEPTION 'You can''t manage this RFQ' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.supplier_quotes WHERE request_id = p_request_id AND supplier_id = p_supplier_id) THEN
    RAISE EXCEPTION 'This supplier has already quoted; the invitation can''t be removed';
  END IF;
  DELETE FROM public.rfq_rfp_invited_suppliers WHERE request_id = p_request_id AND supplier_id = p_supplier_id;
END;
$$;

-- publish: draft → published · close: published / in_progress → evaluation ·
-- reopen: evaluation → published · cancel: anything not awarded or closed.
CREATE OR REPLACE FUNCTION public.rfq_set_status(p_request_id uuid, p_action text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req public.rfq_rfp_requests%ROWTYPE;
  v_next public.rfq_rfp_status;
BEGIN
  IF NOT public.can_manage_rfq(p_request_id) THEN
    RAISE EXCEPTION 'You can''t manage this RFQ' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_req FROM public.rfq_rfp_requests WHERE id = p_request_id FOR UPDATE;

  IF p_action = 'publish' THEN
    IF v_req.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be published'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.rfq_rfp_items WHERE request_id = p_request_id) THEN
      RAISE EXCEPTION 'Add at least one item before publishing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.rfq_rfp_invited_suppliers WHERE request_id = p_request_id) THEN
      RAISE EXCEPTION 'Invite at least one supplier before publishing';
    END IF;
    v_next := 'published';
  ELSIF p_action = 'close' THEN
    IF v_req.status NOT IN ('published', 'in_progress') THEN RAISE EXCEPTION 'Only an open RFQ can be closed'; END IF;
    v_next := 'evaluation';
  ELSIF p_action = 'reopen' THEN
    IF v_req.status <> 'evaluation' THEN RAISE EXCEPTION 'Only an RFQ in evaluation can be reopened'; END IF;
    v_next := 'published';
  ELSIF p_action = 'cancel' THEN
    IF v_req.status IN ('awarded', 'closed', 'cancelled') THEN RAISE EXCEPTION 'This RFQ can no longer be cancelled'; END IF;
    v_next := 'cancelled';
  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  UPDATE public.rfq_rfp_requests
     SET status = v_next,
         issue_date = CASE WHEN p_action = 'publish' THEN CURRENT_DATE ELSE issue_date END,
         updated_at = now()
   WHERE id = p_request_id;
  RETURN v_next::text;
END;
$$;

-- Submit (or replace) a supplier's quote. Portal members of an invited supplier
-- can submit until the deadline; buyers can record a quote on a supplier's
-- behalf while the RFQ is open. p_lines: [{rfq_item_id, unit_price, delivery_days?, notes?}]
CREATE OR REPLACE FUNCTION public.submit_supplier_quote(
  p_request_id uuid,
  p_supplier_id uuid,
  p_lines jsonb,
  p_payment_terms text DEFAULT NULL,
  p_delivery_commitment text DEFAULT NULL,
  p_validity_days integer DEFAULT 30,
  p_warranty text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_internal boolean := public.can_manage_rfq(p_request_id);
  v_req public.rfq_rfp_requests%ROWTYPE;
  v_quote public.supplier_quotes%ROWTYPE;
  v_quote_id uuid;
  v_line jsonb;
  v_item public.rfq_rfp_items%ROWTYPE;
  v_price numeric;
  v_count integer := 0;
BEGIN
  IF NOT v_internal AND NOT public.can_act_for_supplier(p_supplier_id) THEN
    RAISE EXCEPTION 'You can''t submit quotes for this supplier' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.rfq_rfp_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RFQ not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.rfq_rfp_invited_suppliers WHERE request_id = p_request_id AND supplier_id = p_supplier_id
  ) THEN
    RAISE EXCEPTION 'This supplier is not invited to this RFQ';
  END IF;
  IF v_req.status NOT IN ('published', 'in_progress') THEN
    RAISE EXCEPTION 'This RFQ is not accepting quotes';
  END IF;
  IF NOT v_internal AND v_req.submission_deadline IS NOT NULL AND now() > v_req.submission_deadline THEN
    RAISE EXCEPTION 'The submission deadline has passed';
  END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Price at least one item';
  END IF;

  SELECT * INTO v_quote FROM public.supplier_quotes
   WHERE request_id = p_request_id AND supplier_id = p_supplier_id
   ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    IF v_quote.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'This quote is already being evaluated and can''t be changed';
    END IF;
    v_quote_id := v_quote.id;
    UPDATE public.supplier_quotes
       SET status = 'submitted', submission_date = now(), currency = v_req.currency,
           payment_terms = p_payment_terms, delivery_commitment = p_delivery_commitment,
           validity_period = p_validity_days, warranty_offered = p_warranty, notes = p_notes,
           updated_at = now()
     WHERE id = v_quote_id;
    DELETE FROM public.supplier_quote_items WHERE quote_id = v_quote_id;
  ELSE
    INSERT INTO public.supplier_quotes (
      request_id, supplier_id, status, submission_date, currency, payment_terms,
      delivery_commitment, validity_period, warranty_offered, notes, created_by
    ) VALUES (
      p_request_id, p_supplier_id, 'submitted', now(), v_req.currency, p_payment_terms,
      p_delivery_commitment, p_validity_days, p_warranty, p_notes, auth.uid()
    ) RETURNING id INTO v_quote_id;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_item FROM public.rfq_rfp_items
     WHERE id = NULLIF(v_line->>'rfq_item_id', '')::uuid AND request_id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'A quoted line does not belong to this RFQ'; END IF;
    v_price := NULLIF(v_line->>'unit_price', '')::numeric;
    IF v_price IS NULL THEN CONTINUE; END IF;  -- item not quoted
    IF v_price < 0 THEN RAISE EXCEPTION 'Prices can''t be negative'; END IF;

    INSERT INTO public.supplier_quote_items (
      quote_id, rfq_item_id, line_number, unit_price, total_price, delivery_days, notes
    ) VALUES (
      v_quote_id, v_item.id, v_item.line_number, v_price, v_price * v_item.quantity,
      NULLIF(v_line->>'delivery_days', '')::integer, NULLIF(v_line->>'notes', '')
    );
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN RAISE EXCEPTION 'Price at least one item'; END IF;

  UPDATE public.rfq_rfp_invited_suppliers
     SET invitation_status = 'submitted'
   WHERE request_id = p_request_id AND supplier_id = p_supplier_id;

  RETURN v_quote_id;
END;
$$;

-- Award an RFQ to one quote; the others are rejected. Optionally creates a
-- draft PO with the quoted prices, which then goes through normal approval.
CREATE OR REPLACE FUNCTION public.award_rfq(p_quote_id uuid, p_create_po boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote public.supplier_quotes%ROWTYPE;
  v_req public.rfq_rfp_requests%ROWTYPE;
  v_po_id uuid;
BEGIN
  SELECT * INTO v_quote FROM public.supplier_quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF NOT public.can_manage_rfq(v_quote.request_id) THEN
    RAISE EXCEPTION 'You can''t manage this RFQ' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_req FROM public.rfq_rfp_requests WHERE id = v_quote.request_id FOR UPDATE;
  IF v_req.status NOT IN ('published', 'in_progress', 'evaluation') THEN
    RAISE EXCEPTION 'This RFQ can no longer be awarded';
  END IF;
  IF v_quote.status NOT IN ('submitted', 'under_evaluation', 'shortlisted') THEN
    RAISE EXCEPTION 'Only a submitted quote can be awarded';
  END IF;
  IF EXISTS (SELECT 1 FROM public.supplier_blacklist WHERE supplier_id = v_quote.supplier_id AND status = 'blacklisted') THEN
    RAISE EXCEPTION 'This supplier is blacklisted and can''t be awarded';
  END IF;

  UPDATE public.supplier_quotes
     SET status = 'awarded', evaluated_by = auth.uid(), evaluated_at = now(), updated_at = now()
   WHERE id = p_quote_id;
  UPDATE public.supplier_quotes
     SET status = 'rejected', rejection_reason = 'Another quote was awarded', updated_at = now()
   WHERE request_id = v_quote.request_id AND id <> p_quote_id
     AND status IN ('draft', 'submitted', 'under_evaluation', 'shortlisted');
  UPDATE public.rfq_rfp_requests
     SET status = 'awarded', awarded_supplier_id = v_quote.supplier_id, awarded_date = now(), updated_at = now()
   WHERE id = v_quote.request_id;

  IF p_create_po THEN
    INSERT INTO public.purchase_orders (
      po_number, po_date, company_id, supplier_id, status, currency, payment_terms,
      pr_id, created_by, notes
    ) VALUES (
      public.generate_po_number(), CURRENT_DATE, v_req.company_id, v_quote.supplier_id, 'draft',
      COALESCE(v_quote.currency, v_req.currency, 'LKR'), COALESCE(v_quote.payment_terms, v_req.payment_terms),
      v_req.pr_id, auth.uid(),
      'From ' || v_req.request_number || ', quote ' || v_quote.quote_number
    ) RETURNING id INTO v_po_id;

    INSERT INTO public.po_items (
      po_id, item_code, item_name, description, specifications, quantity_ordered, quantity_pending,
      quantity_received, unit_of_measure, unit_price, total_price, warehouse_item_id, delivery_date, notes
    )
    SELECT v_po_id, i.item_code, i.item_name, i.description, i.specifications, i.quantity, i.quantity,
           0, i.unit_of_measure, qi.unit_price, qi.unit_price * i.quantity, i.warehouse_item_id,
           i.delivery_date, qi.notes
      FROM public.supplier_quote_items qi
      JOIN public.rfq_rfp_items i ON i.id = qi.rfq_item_id
     WHERE qi.quote_id = p_quote_id
     ORDER BY i.line_number;
  END IF;

  RETURN v_po_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Supplier invoices from the portal → accounts payable
-- p_lines: [{description, quantity, unit_price}]
-- ─────────────────────────────────────────────────────────────────────────────
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
    three_way_match_status, notes, created_by
  ) VALUES (
    v_po.company_id, v_po.supplier_id, p_po_id, v_grn_id, btrim(p_invoice_number), p_invoice_date,
    COALESCE(p_due_date, p_invoice_date + 30), COALESCE(v_po.currency, 'LKR'),
    0, COALESCE(p_tax_amount, 0), 0, 0, v_po.payment_terms, 'pending_approval',
    'pending', COALESCE(NULLIF(btrim(p_notes), ''), 'Submitted by the supplier through the portal'), auth.uid()
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grants
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.can_manage_rfq(uuid)', 'public.rfq_visible_to_supplier(uuid)', 'public.quote_visible_to_supplier(uuid)',
    'public.po_visible_to_supplier(uuid)', 'public.invoice_visible_to_supplier(uuid)', 'public.can_act_for_supplier(uuid)',
    'public.rfq_invite_suppliers(uuid, uuid[])', 'public.rfq_remove_invitation(uuid, uuid)', 'public.rfq_set_status(uuid, text)',
    'public.submit_supplier_quote(uuid, uuid, jsonb, text, text, integer, text, text)', 'public.award_rfq(uuid, boolean)',
    'public.submit_supplier_invoice(uuid, text, date, date, jsonb, numeric, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
