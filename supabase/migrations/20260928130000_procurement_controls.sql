-- Procurement controls
--
-- 1. Approval rights live in the database. A purchase order moves
--    draft → pending_approval → pending_dept_head_approval → approved only
--    when the person acting holds the right for that level in the PO's
--    company. The PO creator can't approve it, and one person can't give both
--    levels (admins excepted). Lines and commercial terms are locked once a PO
--    is submitted; after approval they change only through an approved
--    amendment.
-- 2. Purchase requisitions: requesters can submit their own drafts (the old
--    update policy blocked it). Approval needs Department Head / HOD rights.
-- 3. Blanket POs get their company, contract activation needs approval rights,
--    and releases (call-offs) are checked against the contract and become an
--    approved PO when a buyer with approval rights accepts them.
-- 4. PO amendments are numbered per PO, carry the actual change, and apply it
--    to the PO when approved.
-- 5. Three-way match is worked out in the database: invoice quantity against
--    accepted GRN quantity (all receipts, less what was already invoiced) and
--    invoice price against PO price. The result can only be changed through the
--    match functions.
--
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Approval authority
-- ─────────────────────────────────────────────────────────────────────────────

-- Company membership for any user (can_access_company only answers for the caller).
CREATE OR REPLACE FUNCTION public.user_in_company(p_user uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user IS NOT NULL AND (
    public.is_super_admin(p_user)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user AND company_id = p_company_id)
    OR EXISTS (SELECT 1 FROM public.user_company_access WHERE user_id = p_user AND company_id = p_company_id)
  )
$$;

-- Approval levels:
--   merchandiser     role "Merchandiser", or a company approver at procurement / manager / custom level
--   department_head  role "Department Head", the company's HOD, or a company approver at hod / manager / finance level
-- Admins hold both. Company approvers with a limit can approve up to that amount.
CREATE OR REPLACE FUNCTION public.has_approval_authority(p_user uuid, p_company_id uuid, p_level text, p_amount numeric DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user IS NOT NULL
     AND (p_company_id IS NULL OR public.user_in_company(p_user, p_company_id) OR public.is_admin(p_user))
     AND (
       public.is_admin(p_user)
       OR (p_level = 'merchandiser' AND public.has_po_approval_role(p_user, 'Merchandiser'))
       OR (p_level = 'department_head' AND (
             public.has_po_approval_role(p_user, 'Department Head')
             OR (p_company_id IS NOT NULL AND public.is_company_hod(p_user, p_company_id))))
       OR EXISTS (
         SELECT 1 FROM public.company_approvers ca
          WHERE ca.user_id = p_user
            AND ca.company_id = p_company_id
            AND ca.approval_level::text = ANY (
                  CASE p_level
                    WHEN 'merchandiser' THEN ARRAY['procurement', 'manager', 'custom']
                    WHEN 'department_head' THEN ARRAY['hod', 'manager', 'finance']
                    ELSE ARRAY[]::text[]
                  END)
            AND (ca.can_approve_up_to_amount IS NULL OR p_amount IS NULL OR p_amount <= ca.can_approve_up_to_amount)
       )
     )
$$;

-- Why p_user can't approve or reject this PO now (NULL = they can).
-- p_level, when given, must match the stage the PO is at (used by emailed approvals).
CREATE OR REPLACE FUNCTION public.po_approval_block_reason_for(p_user uuid, p_po_id uuid, p_level text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_level text;
  v_admin boolean;
BEGIN
  IF p_user IS NULL THEN RETURN 'Sign in to approve purchase orders'; END IF;
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
  IF NOT FOUND THEN RETURN 'Purchase order not found'; END IF;

  v_level := CASE v_po.status::text
               WHEN 'pending_approval' THEN 'merchandiser'
               WHEN 'pending_dept_head_approval' THEN 'department_head'
             END;
  IF v_level IS NULL THEN RETURN 'This purchase order isn''t waiting for approval'; END IF;
  IF p_level IS NOT NULL AND p_level <> v_level THEN
    RETURN CASE v_level
             WHEN 'merchandiser' THEN 'This purchase order is waiting for the first (merchandiser) approval'
             ELSE 'This purchase order is waiting for the final (department head) approval'
           END;
  END IF;

  v_admin := public.is_admin(p_user);
  IF NOT v_admin AND v_po.created_by = p_user THEN
    RETURN 'You created this purchase order, so someone else must approve it';
  END IF;
  IF NOT v_admin AND v_level = 'department_head' AND v_po.merchandiser_approved_by = p_user THEN
    RETURN 'You gave the first approval, so a different person must give the final approval';
  END IF;
  IF NOT public.has_approval_authority(p_user, v_po.company_id, v_level, COALESCE(v_po.final_amount, v_po.total_amount)) THEN
    RETURN CASE v_level
             WHEN 'merchandiser' THEN 'You don''t have merchandiser approval rights for this company, or the amount is above your limit'
             ELSE 'You don''t have department head approval rights for this company, or the amount is above your limit'
           END;
  END IF;
  RETURN NULL;
END;
$$;

-- For the signed-in user (used by the screens).
CREATE OR REPLACE FUNCTION public.po_approval_block_reason(p_po_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.po_approval_block_reason_for(auth.uid(), p_po_id, NULL) $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Purchase order status flow
-- ─────────────────────────────────────────────────────────────────────────────

-- Apply an approve / reject decision. Used by decide_po_approval (screens) and by
-- the po-email-approval function (service role, acting for the emailed approver).
CREATE OR REPLACE FUNCTION public.apply_po_decision(
  p_user uuid, p_po_id uuid, p_approve boolean, p_comments text, p_method text DEFAULT 'manual', p_level text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_status text;
  v_level text;
  v_comments text := NULLIF(btrim(p_comments), '');
BEGIN
  v_reason := public.po_approval_block_reason_for(p_user, p_po_id, p_level);
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
  IF NOT p_approve AND v_comments IS NULL THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;

  SELECT status::text INTO v_status FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  v_level := CASE v_status WHEN 'pending_approval' THEN 'merchandiser' ELSE 'department_head' END;

  IF NOT p_approve THEN
    UPDATE public.purchase_orders SET status = 'rejected', updated_at = now() WHERE id = p_po_id;
  ELSIF v_level = 'merchandiser' THEN
    UPDATE public.purchase_orders
       SET status = 'pending_dept_head_approval', approval_level = 2,
           merchandiser_approved_by = p_user, merchandiser_approved_date = now(), merchandiser_comments = v_comments,
           updated_at = now()
     WHERE id = p_po_id;
  ELSE
    UPDATE public.purchase_orders
       SET status = 'approved', approval_level = 3,
           department_head_approved_by = p_user, department_head_approved_date = now(), department_head_comments = v_comments,
           approved_by = p_user, approved_date = now(), updated_at = now()
     WHERE id = p_po_id;
  END IF;

  INSERT INTO public.po_approvals (po_id, approver_id, action, comments, approval_level, approval_method)
  VALUES (p_po_id, p_user, CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END::public.po_status,
          v_comments, v_level, CASE WHEN p_method = 'email' THEN 'email' ELSE 'manual' END);

  RETURN (SELECT status::text FROM public.purchase_orders WHERE id = p_po_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_po_approval(p_po_id uuid, p_approve boolean, p_comments text DEFAULT NULL)
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.apply_po_decision(auth.uid(), p_po_id, p_approve, p_comments, 'manual', NULL) $$;

CREATE OR REPLACE FUNCTION public.submit_po_for_approval(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF NOT (public.is_admin(auth.uid()) OR v_po.created_by = auth.uid() OR v_po.buyer_id = auth.uid()
          OR (public.can_access_company(v_po.company_id) AND public.has_procurement_access(auth.uid()))) THEN
    RAISE EXCEPTION 'You can''t submit this purchase order' USING ERRCODE = '42501';
  END IF;
  IF v_po.status::text NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Only draft or rejected purchase orders can be submitted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.po_items WHERE po_id = p_po_id AND quantity_ordered > 0) THEN
    RAISE EXCEPTION 'Add at least one line before submitting';
  END IF;

  UPDATE public.purchase_orders
     SET status = 'pending_approval', approval_level = 1,
         merchandiser_approved_by = NULL, merchandiser_approved_date = NULL, merchandiser_comments = NULL,
         department_head_approved_by = NULL, department_head_approved_date = NULL, department_head_comments = NULL,
         approved_by = NULL, approved_date = NULL, updated_at = now()
   WHERE id = p_po_id;

  INSERT INTO public.po_approvals (po_id, approver_id, action, comments, approval_method)
  VALUES (p_po_id, auth.uid(), 'pending_approval', 'Submitted for approval', 'manual');
END;
$$;

-- Guards every status change made by a signed-in user, whatever screen or API
-- call makes it. Service-role and SQL-editor changes (no signed-in user) pass.
CREATE OR REPLACE FUNCTION public.enforce_po_status_flow()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from text := OLD.status::text;
  v_to text := NEW.status::text;
  v_reason text;
BEGIN
  IF v_from = v_to OR auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF (v_from = 'pending_approval' AND v_to IN ('pending_dept_head_approval', 'rejected'))
     OR (v_from = 'pending_dept_head_approval' AND v_to IN ('approved', 'rejected')) THEN
    v_reason := public.po_approval_block_reason_for(v_uid, OLD.id, NULL);
    IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
    -- Record who really approved, whatever the request said.
    IF v_to = 'pending_dept_head_approval' THEN
      NEW.merchandiser_approved_by := v_uid;
      NEW.merchandiser_approved_date := COALESCE(NEW.merchandiser_approved_date, now());
    ELSIF v_to = 'approved' THEN
      NEW.department_head_approved_by := v_uid;
      NEW.department_head_approved_date := COALESCE(NEW.department_head_approved_date, now());
      NEW.approved_by := v_uid;
      NEW.approved_date := COALESCE(NEW.approved_date, now());
    END IF;
    RETURN NEW;
  END IF;

  IF v_to IN ('pending_dept_head_approval', 'approved') THEN
    RAISE EXCEPTION 'A purchase order must pass merchandiser and department head approval in turn (it is %)', replace(v_from, '_', ' ')
      USING ERRCODE = '42501';
  END IF;

  IF (v_to = 'pending_approval' AND v_from IN ('draft', 'rejected'))
     OR (v_to = 'draft' AND v_from IN ('pending_approval', 'pending_dept_head_approval', 'rejected'))
     OR (v_to = 'sent' AND v_from = 'approved')
     OR (v_to = 'acknowledged' AND v_from = 'sent')
     OR (v_to IN ('partially_received', 'completed') AND v_from IN ('approved', 'sent', 'acknowledged', 'partially_received'))
     OR (v_to = 'cancelled' AND v_from NOT IN ('completed', 'cancelled')) THEN
    IF v_to IN ('pending_approval', 'draft') THEN
      -- A new round of approval starts from scratch.
      NEW.approval_level := CASE WHEN v_to = 'draft' THEN 0 ELSE 1 END;
      NEW.merchandiser_approved_by := NULL; NEW.merchandiser_approved_date := NULL;
      NEW.department_head_approved_by := NULL; NEW.department_head_approved_date := NULL;
      NEW.approved_by := NULL; NEW.approved_date := NULL;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'A purchase order can''t go from % to %', replace(v_from, '_', ' '), replace(v_to, '_', ' ');
END;
$$;

DROP TRIGGER IF EXISTS trg_po_status_flow ON public.purchase_orders;
CREATE TRIGGER trg_po_status_flow
  BEFORE UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_po_status_flow();

-- Once submitted, a PO's lines and commercial terms are frozen. Withdraw it to
-- draft to edit, or raise an amendment after approval. The locks apply to
-- requests from the app (role authenticated); statements run inside database
-- functions (amendments, receiving, blanket releases) run as the function owner
-- and pass.
CREATE OR REPLACE FUNCTION public.po_is_locked(p_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$ SELECT p_status IS NOT NULL AND p_status NOT IN ('draft', 'rejected') $$;

CREATE OR REPLACE FUNCTION public.po_status_of(p_po_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT status::text FROM public.purchase_orders WHERE id = p_po_id $$;

CREATE OR REPLACE FUNCTION public.lock_submitted_po_header()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR NOT public.po_is_locked(OLD.status::text) THEN
    RETURN NEW;
  END IF;
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
     OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
     OR NEW.delivery_terms IS DISTINCT FROM OLD.delivery_terms
     OR NEW.expected_delivery_date IS DISTINCT FROM OLD.expected_delivery_date
     OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'This purchase order has been submitted, so its supplier and terms are locked. Raise an amendment instead.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_submitted_po_header ON public.purchase_orders;
CREATE TRIGGER trg_lock_submitted_po_header
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.lock_submitted_po_header();

CREATE OR REPLACE FUNCTION public.lock_submitted_po_lines()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN COALESCE(NEW, OLD); END IF;
  IF NOT public.po_is_locked(public.po_status_of(COALESCE(NEW.po_id, OLD.po_id)))
     AND (TG_OP <> 'UPDATE' OR NOT public.po_is_locked(public.po_status_of(OLD.po_id))) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.po_id = OLD.po_id
     AND NEW.quantity_ordered IS NOT DISTINCT FROM OLD.quantity_ordered
     AND NEW.unit_price IS NOT DISTINCT FROM OLD.unit_price
     AND NEW.total_price IS NOT DISTINCT FROM OLD.total_price
     AND NEW.item_name IS NOT DISTINCT FROM OLD.item_name
     AND NEW.item_code IS NOT DISTINCT FROM OLD.item_code
     AND NEW.warehouse_item_id IS NOT DISTINCT FROM OLD.warehouse_item_id THEN
    RETURN NEW;  -- receiving and notes still update
  END IF;

  RAISE EXCEPTION 'This purchase order has been submitted, so its lines are locked. Raise an amendment instead.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_submitted_po_lines ON public.po_items;
CREATE TRIGGER trg_lock_submitted_po_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.po_items
  FOR EACH ROW EXECUTE FUNCTION public.lock_submitted_po_lines();

-- Approval history: anyone who can see the PO can see its approvals
-- (it was limited to the creator, the buyer and admins).
DROP POLICY IF EXISTS "Users can view approvals for POs they have access to" ON public.po_approvals;
CREATE POLICY "Users can view approvals for POs they have access to" ON public.po_approvals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_approvals.po_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Purchase requisitions
-- ─────────────────────────────────────────────────────────────────────────────

-- Without WITH CHECK the draft-only USING clause also applied to the new row,
-- so a requester could never move their own PR to "submitted".
DROP POLICY IF EXISTS "Users can update their own draft PRs or admins can update any" ON public.purchase_requisitions;
CREATE POLICY "Users can update their own draft PRs or admins can update any" ON public.purchase_requisitions
  FOR UPDATE TO authenticated
  USING ((auth.uid() = requested_by AND status = 'draft') OR public.is_admin(auth.uid()))
  WITH CHECK ((auth.uid() = requested_by AND status IN ('draft', 'submitted', 'cancelled')) OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.pr_approval_block_reason(p_pr_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pr public.purchase_requisitions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'Sign in to approve requisitions'; END IF;
  SELECT * INTO v_pr FROM public.purchase_requisitions WHERE id = p_pr_id;
  IF NOT FOUND THEN RETURN 'Requisition not found'; END IF;
  IF v_pr.status::text NOT IN ('submitted', 'pending_approval') THEN RETURN 'This requisition isn''t waiting for approval'; END IF;
  IF NOT public.is_admin(auth.uid()) AND v_pr.requested_by = auth.uid() THEN
    RETURN 'You raised this requisition, so someone else must approve it';
  END IF;
  IF NOT public.has_approval_authority(auth.uid(), v_pr.company_id, 'department_head', NULL) THEN
    RETURN 'You don''t have approval rights for requisitions in this company';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_purchase_requisition(p_pr_id uuid, p_approve boolean, p_comments text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reason text := public.pr_approval_block_reason(p_pr_id);
  v_comments text := NULLIF(btrim(p_comments), '');
BEGIN
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
  IF NOT p_approve AND v_comments IS NULL THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;

  UPDATE public.purchase_requisitions
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END::public.pr_status,
         approved_by = CASE WHEN p_approve THEN auth.uid() ELSE approved_by END,
         approved_date = CASE WHEN p_approve THEN now() ELSE approved_date END,
         rejection_reason = CASE WHEN p_approve THEN rejection_reason ELSE v_comments END,
         updated_at = now()
   WHERE id = p_pr_id;

  INSERT INTO public.pr_approvals (pr_id, approver_id, action, comments)
  VALUES (p_pr_id, auth.uid(), CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END::public.pr_status, v_comments);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_pr_status_flow()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF OLD.status = NEW.status OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.status::text IN ('approved', 'rejected') THEN
    v_reason := public.pr_approval_block_reason(OLD.id);
    IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
    IF NEW.status::text = 'approved' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_date := COALESCE(NEW.approved_date, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pr_status_flow ON public.purchase_requisitions;
CREATE TRIGGER trg_pr_status_flow
  BEFORE UPDATE OF status ON public.purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pr_status_flow();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Blanket purchase orders and releases
-- ─────────────────────────────────────────────────────────────────────────────

-- Blanket POs were saved without a company, which hid them from everyone but
-- super admins. Take the creator's company.
UPDATE public.blanket_purchase_orders b
   SET company_id = p.company_id
  FROM public.profiles p
 WHERE b.company_id IS NULL AND p.user_id = b.created_by AND p.company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.default_bpo_company()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.profiles WHERE user_id = COALESCE(NEW.created_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_bpo_company ON public.blanket_purchase_orders;
CREATE TRIGGER trg_default_bpo_company
  BEFORE INSERT ON public.blanket_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.default_bpo_company();

-- Activating a contract commits spend, so it needs department head rights for
-- the contract value, from someone other than its author.
CREATE OR REPLACE FUNCTION public.enforce_bpo_status_flow()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_from text := OLD.contract_status::text;
  v_to text := NEW.contract_status::text;
BEGIN
  IF v_from = v_to OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT ((v_from = 'draft' AND v_to IN ('active', 'cancelled'))
       OR (v_from = 'active' AND v_to IN ('suspended', 'expired', 'closed', 'cancelled'))
       OR (v_from = 'suspended' AND v_to IN ('active', 'closed', 'cancelled'))) THEN
    RAISE EXCEPTION 'A blanket PO can''t go from % to %', v_from, v_to;
  END IF;
  IF v_to = 'active' THEN
    IF NOT public.is_admin(auth.uid()) AND OLD.created_by = auth.uid() THEN
      RAISE EXCEPTION 'You created this blanket PO, so someone else must activate it' USING ERRCODE = '42501';
    END IF;
    IF NOT public.has_approval_authority(auth.uid(), OLD.company_id, 'department_head', OLD.total_contract_value) THEN
      RAISE EXCEPTION 'Activating a blanket PO needs department head approval rights for its value' USING ERRCODE = '42501';
    END IF;
    IF v_from = 'draft' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_date := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bpo_status_flow ON public.blanket_purchase_orders;
CREATE TRIGGER trg_bpo_status_flow
  BEFORE UPDATE OF contract_status ON public.blanket_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bpo_status_flow();

ALTER TABLE public.blanket_po_releases
  ADD COLUMN IF NOT EXISTS po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision_notes text;
CREATE INDEX IF NOT EXISTS idx_blanket_po_releases_po ON public.blanket_po_releases(po_id);

-- What is still free on a blanket PO line / the contract, counting releases
-- that are submitted but not yet approved (so two requests can't both spend it).
CREATE OR REPLACE FUNCTION public.bpo_item_available(p_bpo_item_id uuid, p_exclude_release uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN i.total_quantity_limit IS NULL THEN NULL
         ELSE i.total_quantity_limit - COALESCE((
           SELECT SUM(COALESCE(ri.quantity_approved, ri.quantity_requested))
             FROM public.blanket_po_release_items ri
             JOIN public.blanket_po_releases r ON r.id = ri.release_id
            WHERE ri.bpo_item_id = i.id
              AND r.release_status::text IN ('submitted', 'approved', 'sent', 'received', 'completed')
              AND r.id IS DISTINCT FROM p_exclude_release), 0) END
    FROM public.blanket_po_items i WHERE i.id = p_bpo_item_id
$$;

CREATE OR REPLACE FUNCTION public.bpo_value_available(p_bpo_id uuid, p_exclude_release uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.total_contract_value - COALESCE((
           SELECT SUM(r.total_amount) FROM public.blanket_po_releases r
            WHERE r.bpo_id = b.id
              AND r.release_status::text IN ('submitted', 'approved', 'sent', 'received', 'completed')
              AND r.id IS DISTINCT FROM p_exclude_release), 0)
    FROM public.blanket_purchase_orders b WHERE b.id = p_bpo_id
$$;

-- Checks a release against its contract; raises the first problem found.
CREATE OR REPLACE FUNCTION public.check_bpo_release(p_release_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r public.blanket_po_releases%ROWTYPE;
  v_b public.blanket_purchase_orders%ROWTYPE;
  v_line record;
  v_avail numeric;
BEGIN
  SELECT * INTO v_r FROM public.blanket_po_releases WHERE id = p_release_id;
  SELECT * INTO v_b FROM public.blanket_purchase_orders WHERE id = v_r.bpo_id;
  IF v_b.contract_status::text <> 'active' THEN
    RAISE EXCEPTION 'Blanket PO % is %, not active', v_b.bpo_number, v_b.contract_status;
  END IF;
  IF CURRENT_DATE < v_b.contract_start_date OR CURRENT_DATE > v_b.contract_end_date THEN
    RAISE EXCEPTION 'Blanket PO % runs from % to %', v_b.bpo_number, v_b.contract_start_date, v_b.contract_end_date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.blanket_po_release_items WHERE release_id = p_release_id) THEN
    RAISE EXCEPTION 'Add at least one line';
  END IF;

  FOR v_line IN
    SELECT ri.quantity_requested AS qty, i.*
      FROM public.blanket_po_release_items ri
      JOIN public.blanket_po_items i ON i.id = ri.bpo_item_id
     WHERE ri.release_id = p_release_id
  LOOP
    IF v_line.bpo_id <> v_r.bpo_id THEN RAISE EXCEPTION '% isn''t on this blanket PO', v_line.item_name; END IF;
    IF v_line.qty IS NULL OR v_line.qty <= 0 THEN RAISE EXCEPTION 'Enter a quantity above zero for %', v_line.item_name; END IF;
    IF v_line.min_order_quantity IS NOT NULL AND v_line.qty < v_line.min_order_quantity THEN
      RAISE EXCEPTION 'The minimum order for % is %', v_line.item_name, v_line.min_order_quantity;
    END IF;
    IF v_line.max_order_quantity IS NOT NULL AND v_line.qty > v_line.max_order_quantity THEN
      RAISE EXCEPTION 'The maximum order for % is %', v_line.item_name, v_line.max_order_quantity;
    END IF;
    IF v_line.price_validity_end IS NOT NULL AND CURRENT_DATE > v_line.price_validity_end THEN
      RAISE EXCEPTION 'The contract price for % expired on %', v_line.item_name, v_line.price_validity_end;
    END IF;
    v_avail := public.bpo_item_available(v_line.id, p_release_id);
    IF v_avail IS NOT NULL AND v_line.qty > v_avail THEN
      RAISE EXCEPTION 'Only % % of % is left on this blanket PO', greatest(v_avail, 0), v_line.unit_of_measure, v_line.item_name;
    END IF;
  END LOOP;

  v_avail := public.bpo_value_available(v_r.bpo_id, p_release_id);
  IF v_r.total_amount > v_avail THEN
    RAISE EXCEPTION 'This release (% %) is more than the % % left on the blanket PO',
      v_b.currency, round(v_r.total_amount, 2), v_b.currency, round(greatest(v_avail, 0), 2);
  END IF;
END;
$$;

-- p_lines: [{bpo_item_id, quantity, delivery_date?, notes?}]
CREATE OR REPLACE FUNCTION public.create_bpo_release(
  p_bpo_id uuid,
  p_lines jsonb,
  p_expected_delivery_date date DEFAULT NULL,
  p_delivery_location text DEFAULT NULL,
  p_urgency text DEFAULT 'normal',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_b public.blanket_purchase_orders%ROWTYPE;
  v_release uuid;
  v_line jsonb;
  v_item public.blanket_po_items%ROWTYPE;
  v_qty numeric;
  v_price numeric;
BEGIN
  SELECT * INTO v_b FROM public.blanket_purchase_orders WHERE id = p_bpo_id;
  IF NOT FOUND OR NOT public.can_access_company(v_b.company_id)
     OR NOT (public.has_procurement_access(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'You can''t raise releases on this blanket PO' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one line';
  END IF;

  INSERT INTO public.blanket_po_releases (bpo_id, release_number, release_date, requested_by, release_status,
                                          delivery_location, expected_delivery_date, urgency_level, notes)
  VALUES (p_bpo_id, '', CURRENT_DATE, auth.uid(), 'submitted', NULLIF(btrim(p_delivery_location), ''),
          p_expected_delivery_date, COALESCE(NULLIF(p_urgency, ''), 'normal')::public.urgency_level, NULLIF(btrim(p_notes), ''))
  RETURNING id INTO v_release;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_item FROM public.blanket_po_items WHERE id = (v_line->>'bpo_item_id')::uuid AND bpo_id = p_bpo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'A line isn''t on this blanket PO'; END IF;
    v_qty := NULLIF(v_line->>'quantity', '')::numeric;
    v_price := round(v_item.unit_price * (1 - COALESCE(v_item.discount_percentage, 0) / 100), 4);
    INSERT INTO public.blanket_po_release_items (release_id, bpo_item_id, quantity_requested, quantity_approved,
                                                 unit_price, total_price, delivery_date, notes)
    VALUES (v_release, v_item.id, v_qty, v_qty, v_price, round(v_price * COALESCE(v_qty, 0), 2),
            NULLIF(v_line->>'delivery_date', '')::date, NULLIF(btrim(v_line->>'notes'), ''));
  END LOOP;

  PERFORM public.check_bpo_release(v_release);
  RETURN v_release;
END;
$$;

CREATE OR REPLACE FUNCTION public.bpo_release_block_reason(p_release_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r public.blanket_po_releases%ROWTYPE;
  v_company uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'Sign in to approve releases'; END IF;
  SELECT * INTO v_r FROM public.blanket_po_releases WHERE id = p_release_id;
  IF NOT FOUND THEN RETURN 'Release not found'; END IF;
  IF v_r.release_status::text <> 'submitted' THEN RETURN 'This release isn''t waiting for approval'; END IF;
  IF NOT public.is_admin(auth.uid()) AND v_r.requested_by = auth.uid() THEN
    RETURN 'You requested this release, so someone else must approve it';
  END IF;
  SELECT company_id INTO v_company FROM public.blanket_purchase_orders WHERE id = v_r.bpo_id;
  IF NOT public.has_approval_authority(auth.uid(), v_company, 'merchandiser', v_r.total_amount) THEN
    RETURN 'You don''t have approval rights for releases in this company, or the amount is above your limit';
  END IF;
  RETURN NULL;
END;
$$;

-- Approving a release turns it into an approved purchase order at contract
-- prices: the contract was approved when it was activated, so the call-off
-- needs only this one approval.
CREATE OR REPLACE FUNCTION public.decide_bpo_release(p_release_id uuid, p_approve boolean, p_comments text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reason text := public.bpo_release_block_reason(p_release_id);
  v_r public.blanket_po_releases%ROWTYPE;
  v_b public.blanket_purchase_orders%ROWTYPE;
  v_po uuid;
  v_comments text := NULLIF(btrim(p_comments), '');
BEGIN
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_r FROM public.blanket_po_releases WHERE id = p_release_id FOR UPDATE;
  SELECT * INTO v_b FROM public.blanket_purchase_orders WHERE id = v_r.bpo_id FOR UPDATE;

  IF NOT p_approve THEN
    IF v_comments IS NULL THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;
    UPDATE public.blanket_po_releases
       SET release_status = 'cancelled', decision_notes = 'Rejected: ' || v_comments, updated_at = now()
     WHERE id = p_release_id;
    RETURN NULL;
  END IF;

  PERFORM public.check_bpo_release(p_release_id);

  INSERT INTO public.purchase_orders (
    po_number, po_date, company_id, supplier_id, status, currency, payment_terms, delivery_terms,
    expected_delivery_date, notes, created_by, approval_level,
    merchandiser_approved_by, merchandiser_approved_date, merchandiser_comments, approved_by, approved_date
  ) VALUES (
    public.generate_po_number(), CURRENT_DATE, v_b.company_id, v_b.supplier_id, 'approved', v_b.currency,
    v_b.payment_terms, v_b.delivery_terms, v_r.expected_delivery_date,
    format('Release %s against blanket PO %s', v_r.release_number, v_b.bpo_number),
    COALESCE(v_r.requested_by, auth.uid()), 3, auth.uid(), now(), v_comments, auth.uid(), now()
  ) RETURNING id INTO v_po;

  INSERT INTO public.po_items (po_id, item_code, item_name, description, quantity_ordered, quantity_pending, quantity_received,
                               unit_of_measure, unit_price, total_price, warehouse_item_id, delivery_date, notes)
  SELECT v_po, i.item_code, i.item_name, i.description, ri.quantity_requested, ri.quantity_requested, 0,
         i.unit_of_measure, ri.unit_price, ri.total_price, i.warehouse_item_id,
         COALESCE(ri.delivery_date, v_r.expected_delivery_date), ri.notes
    FROM public.blanket_po_release_items ri
    JOIN public.blanket_po_items i ON i.id = ri.bpo_item_id
   WHERE ri.release_id = p_release_id;

  INSERT INTO public.po_approvals (po_id, approver_id, action, comments, approval_level, approval_method)
  VALUES (v_po, auth.uid(), 'approved', COALESCE(v_comments, format('Approved as release %s of blanket PO %s', v_r.release_number, v_b.bpo_number)),
          'merchandiser', 'manual');

  UPDATE public.blanket_po_releases
     SET release_status = 'approved', approved_by = auth.uid(), approved_date = now(),
         po_id = v_po, decision_notes = v_comments, updated_at = now()
   WHERE id = p_release_id;
  -- Re-run the line trigger so quantity_released / remaining_quantity count this release.
  UPDATE public.blanket_po_release_items SET quantity_approved = quantity_requested WHERE release_id = p_release_id;

  RETURN v_po;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_bpo_release(p_release_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r public.blanket_po_releases%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM public.blanket_po_releases WHERE id = p_release_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF NOT (v_r.requested_by = auth.uid() OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only the requester can withdraw this release' USING ERRCODE = '42501';
  END IF;
  IF v_r.release_status::text NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Only releases that aren''t approved yet can be withdrawn';
  END IF;
  UPDATE public.blanket_po_releases SET release_status = 'cancelled', decision_notes = 'Withdrawn by the requester', updated_at = now()
   WHERE id = p_release_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PO amendments
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.po_amendments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_date timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'po_amendments_status_check') THEN
    ALTER TABLE public.po_amendments
      ADD CONSTRAINT po_amendments_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

UPDATE public.po_amendments SET status = 'approved' WHERE approved_by IS NOT NULL AND status = 'pending';

-- Number amendments per PO: PO-2026-0012-A1, -A2, … (the old client-side
-- POAMD-0001 numbering restarted for every PO and hit the unique constraint).
CREATE OR REPLACE FUNCTION public.number_po_amendment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po_number text;
  v_n integer;
BEGIN
  SELECT po_number INTO v_po_number FROM public.purchase_orders WHERE id = NEW.po_id FOR UPDATE;
  SELECT COUNT(*) + 1 INTO v_n FROM public.po_amendments WHERE po_id = NEW.po_id;
  NEW.amendment_number := v_po_number || '-A' || v_n;
  WHILE EXISTS (SELECT 1 FROM public.po_amendments WHERE amendment_number = NEW.amendment_number) LOOP
    v_n := v_n + 1;
    NEW.amendment_number := v_po_number || '-A' || v_n;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_number_po_amendment ON public.po_amendments;
CREATE TRIGGER trg_number_po_amendment
  BEFORE INSERT ON public.po_amendments
  FOR EACH ROW EXECUTE FUNCTION public.number_po_amendment();

-- Amendments are raised through request_po_amendment so the change is validated.
DROP POLICY IF EXISTS "Users can create amendments for their POs" ON public.po_amendments;

-- Turns a requested change into {previous, new} snapshots, checking it against
-- the PO as it is now. Raises if the change is no longer valid.
--   price_change          {lines: [{po_item_id, unit_price}]}
--   quantity_change       {lines: [{po_item_id, quantity}]}
--   delivery_date_change  {expected_delivery_date}
--   terms_change          {payment_terms?, delivery_terms?}
--   item_addition         {lines: [{item_name, item_code?, quantity, unit_price, unit_of_measure?, warehouse_item_id?}]}
--   item_removal          {lines: [{po_item_id}]}
--   other                 no change to apply
CREATE OR REPLACE FUNCTION public.plan_po_amendment(p_po_id uuid, p_type text, p_changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_line jsonb;
  v_item public.po_items%ROWTYPE;
  v_prev jsonb := '[]'::jsonb;
  v_new jsonb := '[]'::jsonb;
  v_val numeric;
  v_total_before numeric;
  v_total_after numeric;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
  SELECT COALESCE(SUM(total_price), 0) INTO v_total_before FROM public.po_items WHERE po_id = p_po_id;
  v_total_after := v_total_before;

  IF p_type = 'other' THEN
    RETURN jsonb_build_object('previous', NULL, 'new', NULL);
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'Describe the change to make';
  END IF;

  IF p_type IN ('price_change', 'quantity_change', 'item_removal') THEN
    IF jsonb_typeof(p_changes->'lines') <> 'array' OR jsonb_array_length(p_changes->'lines') = 0 THEN
      RAISE EXCEPTION 'Choose at least one line to change';
    END IF;
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_changes->'lines') LOOP
      SELECT * INTO v_item FROM public.po_items WHERE id = (v_line->>'po_item_id')::uuid AND po_id = p_po_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'A line isn''t on this purchase order'; END IF;
      IF v_item.id = ANY (v_ids) THEN RAISE EXCEPTION '% is listed twice', v_item.item_name; END IF;
      v_ids := v_ids || v_item.id;

      IF p_type = 'price_change' THEN
        v_val := NULLIF(v_line->>'unit_price', '')::numeric;
        IF v_val IS NULL OR v_val < 0 THEN RAISE EXCEPTION 'Enter a new price for %', v_item.item_name; END IF;
        IF v_val = v_item.unit_price THEN RAISE EXCEPTION 'The new price for % is the same as now', v_item.item_name; END IF;
        v_prev := v_prev || jsonb_build_object('po_item_id', v_item.id, 'item_name', v_item.item_name, 'unit_price', v_item.unit_price);
        v_new := v_new || jsonb_build_object('po_item_id', v_item.id, 'item_name', v_item.item_name, 'unit_price', v_val);
        v_total_after := v_total_after - v_item.total_price + round(v_val * v_item.quantity_ordered, 2);
      ELSIF p_type = 'quantity_change' THEN
        v_val := NULLIF(v_line->>'quantity', '')::numeric;
        IF v_val IS NULL OR v_val <= 0 THEN RAISE EXCEPTION 'Enter a new quantity above zero for %', v_item.item_name; END IF;
        IF v_val = v_item.quantity_ordered THEN RAISE EXCEPTION 'The new quantity for % is the same as now', v_item.item_name; END IF;
        IF v_val < COALESCE(v_item.quantity_received, 0) THEN
          RAISE EXCEPTION '% % of % have already been received', v_item.quantity_received, v_item.unit_of_measure, v_item.item_name;
        END IF;
        v_prev := v_prev || jsonb_build_object('po_item_id', v_item.id, 'item_name', v_item.item_name, 'quantity', v_item.quantity_ordered);
        v_new := v_new || jsonb_build_object('po_item_id', v_item.id, 'item_name', v_item.item_name, 'quantity', v_val);
        v_total_after := v_total_after - v_item.total_price + round(v_item.unit_price * v_val, 2);
      ELSE
        IF COALESCE(v_item.quantity_received, 0) > 0 THEN
          RAISE EXCEPTION '% has already been received, so it can''t be removed', v_item.item_name;
        END IF;
        v_prev := v_prev || jsonb_build_object('po_item_id', v_item.id, 'item_name', v_item.item_name,
                    'quantity', v_item.quantity_ordered, 'unit_price', v_item.unit_price);
        v_total_after := v_total_after - v_item.total_price;
      END IF;
    END LOOP;
    IF p_type = 'item_removal' AND NOT EXISTS (SELECT 1 FROM public.po_items WHERE po_id = p_po_id AND id <> ALL (v_ids)) THEN
      RAISE EXCEPTION 'A purchase order needs at least one line. Cancel it instead.';
    END IF;
    RETURN jsonb_build_object(
      'previous', jsonb_build_object('lines', v_prev, 'total', v_total_before),
      'new', jsonb_build_object('lines', CASE WHEN p_type = 'item_removal' THEN '[]'::jsonb ELSE v_new END,
                                'remove', CASE WHEN p_type = 'item_removal' THEN to_jsonb(v_ids) ELSE NULL END,
                                'total', v_total_after));
  END IF;

  IF p_type = 'item_addition' THEN
    IF jsonb_typeof(p_changes->'lines') <> 'array' OR jsonb_array_length(p_changes->'lines') = 0 THEN
      RAISE EXCEPTION 'Add at least one line';
    END IF;
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_changes->'lines') LOOP
      IF NULLIF(btrim(v_line->>'item_name'), '') IS NULL THEN RAISE EXCEPTION 'Name each new item'; END IF;
      IF COALESCE(NULLIF(v_line->>'quantity', '')::numeric, 0) <= 0 THEN
        RAISE EXCEPTION 'Enter a quantity above zero for %', v_line->>'item_name';
      END IF;
      IF NULLIF(v_line->>'unit_price', '')::numeric IS NULL OR (v_line->>'unit_price')::numeric < 0 THEN
        RAISE EXCEPTION 'Enter a price for %', v_line->>'item_name';
      END IF;
      v_new := v_new || jsonb_build_object(
        'item_name', btrim(v_line->>'item_name'),
        'item_code', NULLIF(btrim(v_line->>'item_code'), ''),
        'quantity', (v_line->>'quantity')::numeric,
        'unit_price', (v_line->>'unit_price')::numeric,
        'unit_of_measure', COALESCE(NULLIF(btrim(v_line->>'unit_of_measure'), ''), 'pcs'),
        'warehouse_item_id', NULLIF(v_line->>'warehouse_item_id', ''));
      v_total_after := v_total_after + round((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric, 2);
    END LOOP;
    RETURN jsonb_build_object('previous', jsonb_build_object('lines', '[]'::jsonb, 'total', v_total_before),
                              'new', jsonb_build_object('lines', v_new, 'total', v_total_after));
  END IF;

  IF p_type = 'delivery_date_change' THEN
    IF NULLIF(p_changes->>'expected_delivery_date', '') IS NULL THEN RAISE EXCEPTION 'Choose the new delivery date'; END IF;
    IF (p_changes->>'expected_delivery_date')::date IS NOT DISTINCT FROM v_po.expected_delivery_date THEN
      RAISE EXCEPTION 'The new delivery date is the same as now';
    END IF;
    RETURN jsonb_build_object('previous', jsonb_build_object('expected_delivery_date', v_po.expected_delivery_date),
                              'new', jsonb_build_object('expected_delivery_date', (p_changes->>'expected_delivery_date')::date));
  END IF;

  IF p_type = 'terms_change' THEN
    IF NOT (p_changes ? 'payment_terms' OR p_changes ? 'delivery_terms') THEN
      RAISE EXCEPTION 'Enter the new payment or delivery terms';
    END IF;
    IF COALESCE(p_changes->>'payment_terms', v_po.payment_terms) IS NOT DISTINCT FROM v_po.payment_terms
       AND COALESCE(p_changes->>'delivery_terms', v_po.delivery_terms) IS NOT DISTINCT FROM v_po.delivery_terms THEN
      RAISE EXCEPTION 'The new terms are the same as now';
    END IF;
    RETURN jsonb_build_object(
      'previous', jsonb_build_object('payment_terms', v_po.payment_terms, 'delivery_terms', v_po.delivery_terms),
      'new', jsonb_build_object('payment_terms', COALESCE(p_changes->>'payment_terms', v_po.payment_terms),
                                'delivery_terms', COALESCE(p_changes->>'delivery_terms', v_po.delivery_terms)));
  END IF;

  RAISE EXCEPTION 'Unknown amendment type %', p_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_po_amendment(
  p_po_id uuid, p_type text, p_reason text, p_notes text DEFAULT NULL, p_changes jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_plan jsonb;
  v_id uuid;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
  IF NOT FOUND OR NOT (public.is_admin(auth.uid()) OR v_po.created_by = auth.uid() OR v_po.buyer_id = auth.uid()
                       OR (public.can_access_company(v_po.company_id) AND public.has_procurement_access(auth.uid()))) THEN
    RAISE EXCEPTION 'You can''t amend this purchase order' USING ERRCODE = '42501';
  END IF;
  IF v_po.status::text NOT IN ('approved', 'sent', 'acknowledged', 'partially_received') THEN
    RAISE EXCEPTION 'Only approved purchase orders that aren''t complete can be amended. Edit drafts directly.';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Give a reason for the amendment'; END IF;
  IF EXISTS (SELECT 1 FROM public.po_amendments WHERE po_id = p_po_id AND status = 'pending') THEN
    RAISE EXCEPTION 'This purchase order already has an amendment waiting for approval';
  END IF;

  v_plan := public.plan_po_amendment(p_po_id, p_type, p_changes);

  INSERT INTO public.po_amendments (amendment_number, po_id, amendment_type, reason, notes, previous_value, new_value, created_by, status)
  VALUES ('', p_po_id, p_type::public.po_amendment_type, btrim(p_reason), NULLIF(btrim(p_notes), ''),
          v_plan->'previous', v_plan->'new', auth.uid(), 'pending')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.po_amendment_block_reason(p_amendment_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_a public.po_amendments%ROWTYPE;
  v_po public.purchase_orders%ROWTYPE;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'Sign in to approve amendments'; END IF;
  SELECT * INTO v_a FROM public.po_amendments WHERE id = p_amendment_id;
  IF NOT FOUND THEN RETURN 'Amendment not found'; END IF;
  IF v_a.status <> 'pending' THEN RETURN 'This amendment has already been decided'; END IF;
  IF NOT public.is_admin(auth.uid()) AND v_a.created_by = auth.uid() THEN
    RETURN 'You requested this amendment, so someone else must approve it';
  END IF;
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_a.po_id;
  v_amount := GREATEST(COALESCE((v_a.new_value->>'total')::numeric, 0), COALESCE(v_po.final_amount, v_po.total_amount, 0));
  IF NOT public.has_approval_authority(auth.uid(), v_po.company_id, 'department_head', v_amount) THEN
    RETURN 'Amendments need department head approval rights for this company';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_po_amendment(p_amendment_id uuid, p_approve boolean, p_comments text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reason text := public.po_amendment_block_reason(p_amendment_id);
  v_a public.po_amendments%ROWTYPE;
  v_po public.purchase_orders%ROWTYPE;
  v_plan jsonb;
  v_line jsonb;
  v_comments text := NULLIF(btrim(p_comments), '');
BEGIN
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_a FROM public.po_amendments WHERE id = p_amendment_id FOR UPDATE;
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_a.po_id FOR UPDATE;

  IF NOT p_approve THEN
    IF v_comments IS NULL THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;
    UPDATE public.po_amendments
       SET status = 'rejected', rejected_by = auth.uid(), rejected_date = now(), rejection_reason = v_comments
     WHERE id = p_amendment_id;
    RETURN;
  END IF;

  IF v_a.new_value IS NOT NULL THEN
    IF v_po.status::text NOT IN ('approved', 'sent', 'acknowledged', 'partially_received') THEN
      RAISE EXCEPTION 'The purchase order is now %, so this amendment can''t be applied', replace(v_po.status::text, '_', ' ');
    END IF;

    -- Re-check against the PO as it is now (goods may have arrived since).
    v_plan := public.plan_po_amendment(v_po.id, v_a.amendment_type::text,
      CASE WHEN v_a.amendment_type::text = 'item_removal'
        THEN jsonb_build_object('lines',
               (SELECT jsonb_agg(jsonb_build_object('po_item_id', x)) FROM jsonb_array_elements_text(v_a.new_value->'remove') x))
        ELSE v_a.new_value
      END);

    CASE v_a.amendment_type::text
      WHEN 'price_change' THEN
        FOR v_line IN SELECT * FROM jsonb_array_elements(v_plan->'new'->'lines') LOOP
          UPDATE public.po_items
             SET unit_price = (v_line->>'unit_price')::numeric,
                 total_price = round((v_line->>'unit_price')::numeric * quantity_ordered, 2), updated_at = now()
           WHERE id = (v_line->>'po_item_id')::uuid;
        END LOOP;
      WHEN 'quantity_change' THEN
        FOR v_line IN SELECT * FROM jsonb_array_elements(v_plan->'new'->'lines') LOOP
          UPDATE public.po_items
             SET quantity_ordered = (v_line->>'quantity')::numeric,
                 quantity_pending = (v_line->>'quantity')::numeric - COALESCE(quantity_received, 0),
                 total_price = round(unit_price * (v_line->>'quantity')::numeric, 2), updated_at = now()
           WHERE id = (v_line->>'po_item_id')::uuid;
        END LOOP;
      WHEN 'item_removal' THEN
        BEGIN
          DELETE FROM public.po_items
           WHERE id IN (SELECT x::uuid FROM jsonb_array_elements_text(v_plan->'new'->'remove') x);
        EXCEPTION WHEN foreign_key_violation THEN
          RAISE EXCEPTION 'A line to remove is already used on a goods receipt or another document, so it can''t be removed';
        END;
      WHEN 'item_addition' THEN
        INSERT INTO public.po_items (po_id, item_code, item_name, quantity_ordered, quantity_pending, quantity_received,
                                     unit_of_measure, unit_price, total_price, warehouse_item_id)
        SELECT v_po.id, l->>'item_code', l->>'item_name', (l->>'quantity')::numeric, (l->>'quantity')::numeric, 0,
               l->>'unit_of_measure', (l->>'unit_price')::numeric,
               round((l->>'quantity')::numeric * (l->>'unit_price')::numeric, 2), NULLIF(l->>'warehouse_item_id', '')::uuid
          FROM jsonb_array_elements(v_plan->'new'->'lines') l;
      WHEN 'delivery_date_change' THEN
        UPDATE public.purchase_orders SET expected_delivery_date = (v_plan->'new'->>'expected_delivery_date')::date, updated_at = now()
         WHERE id = v_po.id;
      WHEN 'terms_change' THEN
        UPDATE public.purchase_orders
           SET payment_terms = v_plan->'new'->>'payment_terms', delivery_terms = v_plan->'new'->>'delivery_terms', updated_at = now()
         WHERE id = v_po.id;
      ELSE
        NULL;
    END CASE;
  END IF;

  UPDATE public.po_amendments
     SET status = 'approved', approved_by = auth.uid(), approved_date = now(),
         applied_at = CASE WHEN v_a.new_value IS NOT NULL THEN now() END,
         previous_value = COALESCE(v_plan->'previous', previous_value),
         new_value = COALESCE(v_plan->'new', new_value),
         notes = CASE WHEN v_comments IS NULL THEN notes ELSE concat_ws(E'\n', notes, 'Approver: ' || v_comments) END
   WHERE id = p_amendment_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Three-way match
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.supplier_invoices'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%three_way_match_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.supplier_invoices DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

-- partial / mismatch / auto_matched are still written by the e-invoice sync.
ALTER TABLE public.supplier_invoices
  ADD CONSTRAINT supplier_invoices_three_way_match_status_check
  CHECK (three_way_match_status IN ('pending', 'matched', 'auto_matched', 'partial', 'mismatch', 'exception', 'failed'));

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS three_way_match_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS three_way_match_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS three_way_match_notes text;

-- Optional exact link from an invoice line to the PO line it bills.
ALTER TABLE public.supplier_invoice_lines
  ADD COLUMN IF NOT EXISTS po_item_id uuid REFERENCES public.po_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_lines_po_item ON public.supplier_invoice_lines(po_item_id);

CREATE OR REPLACE FUNCTION public.check_invoice_line_po_item()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.po_item_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.po_items pi JOIN public.supplier_invoices si ON si.po_id = pi.po_id
        WHERE pi.id = NEW.po_item_id AND si.id = NEW.invoice_id) THEN
    RAISE EXCEPTION 'An invoice line refers to a line of a different purchase order';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_invoice_line_po_item ON public.supplier_invoice_lines;
CREATE TRIGGER trg_check_invoice_line_po_item
  BEFORE INSERT OR UPDATE OF po_item_id ON public.supplier_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.check_invoice_line_po_item();

-- Who may look at and run matching for an invoice.
CREATE OR REPLACE FUNCTION public.can_review_invoice_match(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin(auth.uid())
      OR (public.can_access_company(p_company_id)
          AND (public.has_finance_access(auth.uid()) OR public.has_procurement_access(auth.uid())))
$$;

-- One row per PO line, plus any invoice line that matches no PO line.
-- Invoice lines are tied to PO lines by po_item_id, else by item name or code
-- (portal invoices describe lines as "CODE · Name"), else by position.
--   qty_status   match | over (above accepted quantity, less what earlier invoices
--                already billed) | not_received | not_invoiced | extra
--   price_status match | tolerance (within p_price_tolerance %) | under | over | missing
CREATE OR REPLACE FUNCTION public.three_way_match_lines_internal(
  p_invoice_id uuid, p_price_tolerance numeric DEFAULT 2, p_qty_tolerance numeric DEFAULT 0
)
RETURNS TABLE (
  po_item_id uuid, item_name text, item_code text, unit_of_measure text,
  po_qty numeric, po_unit_price numeric, received_qty numeric, invoiced_before numeric,
  invoice_qty numeric, invoice_unit_price numeric, qty_status text, price_status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_line record;
  v_target uuid;
  v_map jsonb := '{}'::jsonb;       -- po_item_id → {qty, amount}
  v_extra jsonb := '[]'::jsonb;     -- invoice lines with no PO line
  v_used uuid[] := ARRAY[]::uuid[];
  v_item record;
  v_q numeric;
  v_p numeric;
BEGIN
  SELECT * INTO v_inv FROM public.supplier_invoices WHERE id = p_invoice_id;
  IF NOT FOUND OR v_inv.po_id IS NULL THEN RETURN; END IF;

  FOR v_line IN SELECT * FROM public.supplier_invoice_lines WHERE invoice_id = p_invoice_id ORDER BY line_number LOOP
    v_target := NULL;
    IF v_line.po_item_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.po_items WHERE id = v_line.po_item_id AND po_id = v_inv.po_id) THEN
      v_target := v_line.po_item_id;
    END IF;
    IF v_target IS NULL THEN
      SELECT pi.id INTO v_target FROM public.po_items pi
       WHERE pi.po_id = v_inv.po_id AND pi.id <> ALL (v_used)
         AND (lower(btrim(v_line.description)) = lower(btrim(pi.item_name))
              OR (pi.item_code IS NOT NULL AND lower(btrim(v_line.description)) = lower(btrim(pi.item_code)))
              OR (pi.item_code IS NOT NULL AND v_line.description ILIKE pi.item_code || ' %'))
       ORDER BY pi.created_at, pi.id LIMIT 1;
    END IF;
    IF v_target IS NULL THEN
      SELECT x.id INTO v_target FROM (
        SELECT pi.id, row_number() OVER (ORDER BY pi.created_at, pi.id) AS n
          FROM public.po_items pi WHERE pi.po_id = v_inv.po_id) x
       WHERE x.n = v_line.line_number AND x.id <> ALL (v_used);
    END IF;

    IF v_target IS NULL THEN
      v_extra := v_extra || jsonb_build_object('description', v_line.description, 'qty', v_line.quantity, 'price', v_line.unit_price);
    ELSE
      v_used := v_used || v_target;
      v_map := jsonb_set(v_map, ARRAY[v_target::text], jsonb_build_object(
        'qty', COALESCE((v_map->v_target::text->>'qty')::numeric, 0) + COALESCE(v_line.quantity, 0),
        'amount', COALESCE((v_map->v_target::text->>'amount')::numeric, 0) + COALESCE(v_line.quantity, 0) * COALESCE(v_line.unit_price, 0)));
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT pi.id AS line_id, pi.item_name AS name, pi.item_code AS code, pi.unit_of_measure AS uom,
           pi.quantity_ordered AS ordered, pi.unit_price AS price,
           COALESCE((SELECT SUM(gi.quantity_accepted) FROM public.grn_items gi
                       JOIN public.goods_receipt_notes g ON g.id = gi.grn_id
                      WHERE gi.po_item_id = pi.id AND g.status IN ('approved', 'completed')), 0) AS accepted,
           COALESCE((SELECT SUM(l.quantity) FROM public.supplier_invoice_lines l
                       JOIN public.supplier_invoices si ON si.id = l.invoice_id
                      WHERE l.po_item_id = pi.id AND si.id <> p_invoice_id
                        AND (si.invoice_date, COALESCE(si.created_at, '-infinity'), si.id)
                          < (v_inv.invoice_date, COALESCE(v_inv.created_at, '-infinity'), v_inv.id)
                        AND COALESCE(si.status, '') <> 'cancelled'
                        AND COALESCE(si.three_way_match_status, '') <> 'failed'), 0) AS prev_billed
      FROM public.po_items pi WHERE pi.po_id = v_inv.po_id ORDER BY pi.created_at, pi.id
  LOOP
    v_q := (v_map->v_item.line_id::text->>'qty')::numeric;
    v_p := CASE WHEN v_q IS NULL OR v_q = 0 THEN NULL ELSE round((v_map->v_item.line_id::text->>'amount')::numeric / v_q, 4) END;
    po_item_id := v_item.line_id; item_name := v_item.name; item_code := v_item.code; unit_of_measure := v_item.uom;
    po_qty := v_item.ordered; po_unit_price := v_item.price;
    received_qty := v_item.accepted; invoiced_before := v_item.prev_billed;
    invoice_qty := v_q; invoice_unit_price := v_p;
    qty_status := CASE
      WHEN v_q IS NULL THEN 'not_invoiced'
      WHEN v_item.accepted <= 0 THEN 'not_received'
      WHEN v_q + v_item.prev_billed > v_item.accepted + p_qty_tolerance THEN 'over'
      ELSE 'match' END;
    price_status := CASE
      WHEN v_p IS NULL THEN 'missing'
      WHEN v_p = v_item.price THEN 'match'
      WHEN v_item.price > 0 AND abs(v_p - v_item.price) / v_item.price * 100 <= p_price_tolerance THEN 'tolerance'
      WHEN v_p < v_item.price THEN 'under'
      ELSE 'over' END;
    RETURN NEXT;
  END LOOP;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_extra) LOOP
    po_item_id := NULL; item_name := COALESCE(v_line.value->>'description', 'Invoice line'); item_code := NULL; unit_of_measure := NULL;
    po_qty := NULL; po_unit_price := NULL; received_qty := NULL; invoiced_before := NULL;
    invoice_qty := (v_line.value->>'qty')::numeric; invoice_unit_price := (v_line.value->>'price')::numeric;
    qty_status := 'extra'; price_status := 'missing';
    RETURN NEXT;
  END LOOP;
END;
$$;

-- pending   no approved goods receipt yet, or nothing on the invoice ties to a PO line
-- exception an invoice line has no PO line, bills more than was accepted, bills
--           goods not yet received, or is priced above the PO beyond tolerance
-- matched   everything billed was received and priced within tolerance
CREATE OR REPLACE FUNCTION public.evaluate_three_way_match(p_invoice_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH l AS (SELECT * FROM public.three_way_match_lines_internal(p_invoice_id))
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM l) THEN 'pending'
    WHEN NOT EXISTS (SELECT 1 FROM l WHERE received_qty > 0) THEN 'pending'
    WHEN EXISTS (SELECT 1 FROM l WHERE qty_status IN ('extra', 'over', 'not_received') OR price_status = 'over') THEN 'exception'
    WHEN NOT EXISTS (SELECT 1 FROM l WHERE invoice_qty IS NOT NULL) THEN 'pending'
    ELSE 'matched'
  END
$$;

-- For the screens: the same lines, after checking the caller may see the invoice.
CREATE OR REPLACE FUNCTION public.three_way_match_lines(
  p_invoice_id uuid, p_price_tolerance numeric DEFAULT 2, p_qty_tolerance numeric DEFAULT 0
)
RETURNS TABLE (
  po_item_id uuid, item_name text, item_code text, unit_of_measure text,
  po_qty numeric, po_unit_price numeric, received_qty numeric, invoiced_before numeric,
  invoice_qty numeric, invoice_unit_price numeric, qty_status text, price_status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_review_invoice_match((SELECT company_id FROM public.supplier_invoices WHERE id = p_invoice_id)) THEN
    RAISE EXCEPTION 'You can''t see this invoice' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.three_way_match_lines_internal(p_invoice_id, p_price_tolerance, p_qty_tolerance);
END;
$$;

-- The stored result can't be edited directly from the app; it is set by the
-- functions below (and by the e-invoice sync, which also runs in the database).
CREATE OR REPLACE FUNCTION public.guard_three_way_match_status()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.three_way_match_status IS DISTINCT FROM OLD.three_way_match_status
          OR NEW.three_way_match_by IS DISTINCT FROM OLD.three_way_match_by
          OR NEW.three_way_match_notes IS DISTINCT FROM OLD.three_way_match_notes) THEN
    RAISE EXCEPTION 'Use the three-way match screen to change the match result' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_three_way_match_status ON public.supplier_invoices;
CREATE TRIGGER trg_guard_three_way_match_status
  BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_three_way_match_status();

-- Re-run the automatic check. A person's decision (accepted or failed) stays.
CREATE OR REPLACE FUNCTION public.run_three_way_match(p_invoice_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_status text;
  v_grn uuid;
BEGIN
  SELECT * INTO v_inv FROM public.supplier_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_inv.po_id IS NULL THEN RETURN NULL; END IF;
  IF NOT public.can_review_invoice_match(v_inv.company_id) THEN
    RAISE EXCEPTION 'You can''t run matching for this invoice' USING ERRCODE = '42501';
  END IF;
  IF v_inv.three_way_match_by IS NOT NULL AND v_inv.three_way_match_status IN ('matched', 'failed') THEN
    RETURN v_inv.three_way_match_status;
  END IF;

  v_status := public.evaluate_three_way_match(p_invoice_id);
  SELECT g.id INTO v_grn FROM public.goods_receipt_notes g
   WHERE g.po_id = v_inv.po_id AND g.status IN ('approved', 'completed')
   ORDER BY g.approved_date DESC NULLS LAST LIMIT 1;

  UPDATE public.supplier_invoices
     SET three_way_match_status = v_status, three_way_match_checked_at = now(),
         grn_id = COALESCE(grn_id, v_grn)
   WHERE id = p_invoice_id;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_three_way_match_all(p_company_id uuid)
RETURNS TABLE (matched integer, exceptions integer, pending integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status text;
BEGIN
  IF NOT public.can_review_invoice_match(p_company_id) THEN
    RAISE EXCEPTION 'You can''t run matching for this company' USING ERRCODE = '42501';
  END IF;
  matched := 0; exceptions := 0; pending := 0;
  FOR v_id IN
    SELECT si.id FROM public.supplier_invoices si
     WHERE si.company_id = p_company_id AND si.po_id IS NOT NULL AND COALESCE(si.status, '') <> 'cancelled'
       AND (si.three_way_match_by IS NULL OR si.three_way_match_status NOT IN ('matched', 'failed'))
  LOOP
    v_status := public.run_three_way_match(v_id);
    IF v_status = 'matched' THEN matched := matched + 1;
    ELSIF v_status = 'exception' THEN exceptions := exceptions + 1;
    ELSE pending := pending + 1; END IF;
  END LOOP;
  RETURN NEXT;
END;
$$;

-- A finance user accepts (giving a reason when it doesn't match) or fails it.
CREATE OR REPLACE FUNCTION public.decide_three_way_match(p_invoice_id uuid, p_accept boolean, p_reason text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_eval text;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  SELECT * INTO v_inv FROM public.supplier_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_inv.po_id IS NULL THEN RAISE EXCEPTION 'Invoice not found or not linked to a purchase order'; END IF;
  IF NOT (public.is_admin(auth.uid()) OR (public.can_access_company(v_inv.company_id) AND public.has_finance_access(auth.uid()))) THEN
    RAISE EXCEPTION 'Only finance users can decide a three-way match' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin(auth.uid()) AND v_inv.created_by = auth.uid() THEN
    RAISE EXCEPTION 'You entered this invoice, so someone else must decide its match' USING ERRCODE = '42501';
  END IF;

  v_eval := public.evaluate_three_way_match(p_invoice_id);
  IF p_accept AND v_eval <> 'matched' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'The invoice doesn''t match the order and receipts. Give a reason to accept it anyway.';
  END IF;
  IF NOT p_accept AND v_reason IS NULL THEN RAISE EXCEPTION 'Give a reason for failing the match'; END IF;

  UPDATE public.supplier_invoices
     SET three_way_match_status = CASE WHEN p_accept THEN 'matched' ELSE 'failed' END,
         three_way_match_by = auth.uid(), three_way_match_checked_at = now(),
         three_way_match_notes = CASE
           WHEN p_accept AND v_eval <> 'matched' THEN 'Accepted with differences: ' || v_reason
           WHEN p_accept THEN v_reason
           ELSE 'Failed: ' || v_reason END
   WHERE id = p_invoice_id;
  RETURN CASE WHEN p_accept THEN 'matched' ELSE 'failed' END;
END;
$$;

-- Everything the match screen needs, one row per PO-linked invoice (latest 500).
CREATE OR REPLACE FUNCTION public.three_way_match_overview(p_company_id uuid)
RETURNS TABLE (
  invoice_id uuid, invoice_number text, invoice_date date, currency text, supplier_name text,
  po_id uuid, po_number text, grn_numbers text, po_amount numeric, received_amount numeric, invoice_amount numeric,
  stored_status text, computed_status text, decided boolean, notes text, lines jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv record;
BEGIN
  IF NOT public.can_review_invoice_match(p_company_id) THEN
    RAISE EXCEPTION 'You can''t see invoices for this company' USING ERRCODE = '42501';
  END IF;
  FOR v_inv IN
    SELECT si.id AS inv_id, si.invoice_number AS inv_no, si.invoice_date AS inv_date, si.currency AS cur,
           si.po_id AS inv_po, si.gross_amount AS gross, si.three_way_match_status AS st,
           si.three_way_match_by AS decided_by, si.three_way_match_notes AS st_notes,
           po.po_number AS po_no, COALESCE(po.final_amount, po.total_amount, 0) AS po_amt, s.name AS supplier
      FROM public.supplier_invoices si
      JOIN public.purchase_orders po ON po.id = si.po_id
      LEFT JOIN public.suppliers s ON s.id = si.supplier_id
     WHERE si.company_id = p_company_id AND COALESCE(si.status, '') <> 'cancelled'
     ORDER BY si.invoice_date DESC, si.invoice_number
     LIMIT 500
  LOOP
    invoice_id := v_inv.inv_id; invoice_number := v_inv.inv_no; invoice_date := v_inv.inv_date;
    currency := v_inv.cur; supplier_name := COALESCE(v_inv.supplier, 'Unknown supplier');
    po_id := v_inv.inv_po; po_number := v_inv.po_no; po_amount := v_inv.po_amt;
    invoice_amount := COALESCE(v_inv.gross, 0);
    SELECT string_agg(g.grn_number, ', ' ORDER BY g.grn_date) INTO grn_numbers
      FROM public.goods_receipt_notes g WHERE g.po_id = v_inv.inv_po AND g.status IN ('approved', 'completed');
    SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb),
           COALESCE(SUM(COALESCE(l.received_qty, 0) * COALESCE(l.po_unit_price, 0)), 0)
      INTO lines, received_amount
      FROM public.three_way_match_lines_internal(v_inv.inv_id) l;
    stored_status := COALESCE(v_inv.st, 'pending');
    computed_status := public.evaluate_three_way_match(v_inv.inv_id);
    decided := v_inv.decided_by IS NOT NULL;
    notes := v_inv.st_notes;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Grants
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  -- Called by the screens.
  FOREACH f IN ARRAY ARRAY[
    'public.po_approval_block_reason(uuid)',
    'public.decide_po_approval(uuid, boolean, text)',
    'public.submit_po_for_approval(uuid)',
    'public.pr_approval_block_reason(uuid)',
    'public.decide_purchase_requisition(uuid, boolean, text)',
    'public.create_bpo_release(uuid, jsonb, date, text, text, text)',
    'public.bpo_release_block_reason(uuid)',
    'public.decide_bpo_release(uuid, boolean, text)',
    'public.cancel_bpo_release(uuid)',
    'public.request_po_amendment(uuid, text, text, text, jsonb)',
    'public.po_amendment_block_reason(uuid)',
    'public.decide_po_amendment(uuid, boolean, text)',
    'public.three_way_match_lines(uuid, numeric, numeric)',
    'public.run_three_way_match(uuid)',
    'public.run_three_way_match_all(uuid)',
    'public.decide_three_way_match(uuid, boolean, text)',
    'public.three_way_match_overview(uuid)',
    'public.po_status_of(uuid)'  -- used by the line lock, which runs as the caller
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;

  -- Internal helpers (some take a user id), for other database functions and the
  -- po-email-approval function only.
  FOREACH f IN ARRAY ARRAY[
    'public.user_in_company(uuid, uuid)',
    'public.has_approval_authority(uuid, uuid, text, numeric)',
    'public.po_approval_block_reason_for(uuid, uuid, text)',
    'public.apply_po_decision(uuid, uuid, boolean, text, text, text)',
    'public.plan_po_amendment(uuid, text, jsonb)',
    'public.check_bpo_release(uuid)',
    'public.bpo_item_available(uuid, uuid)',
    'public.bpo_value_available(uuid, uuid)',
    'public.can_review_invoice_match(uuid)',
    'public.three_way_match_lines_internal(uuid, numeric, numeric)',
    'public.evaluate_three_way_match(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;
