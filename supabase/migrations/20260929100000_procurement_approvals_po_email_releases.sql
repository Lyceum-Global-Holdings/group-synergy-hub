-- Procurement: requisition approval levels, company approvers, PO email and
-- blanket-PO releases.
--
-- 1. Requisitions get a second approval level. A department head (the role,
--    the company's head of department, or a company approver at hod / manager /
--    finance level) approves first, within their amount limit. Above the
--    company's threshold a final approval follows, from a manager or finance
--    approver whose limit covers the amount, the company's manager, or an admin
--    — never the requester or the first approver. Each approval is recorded
--    with its level. Lines are frozen once submitted, and the status moves only
--    by submitting and through decide_purchase_requisition.
-- 2. Company approvers and the requisition threshold are kept from
--    Admin › Companies › Approvers & limits. Approvers must be active users of
--    the company.
-- 3. A requisition's bill of materials must belong to its company.
-- 4. Purchase orders record when, and to whom, they were emailed; the
--    sourcing-notify edge function sends them on "Send PO".
-- 5. Blanket-PO releases follow their purchase order: sent, received,
--    completed, or cancelled (which puts the value back on the contract).
--
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Requisition approval levels
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS first_approved_by uuid,
  ADD COLUMN IF NOT EXISTS first_approved_at timestamptz;

ALTER TABLE public.pr_approvals
  ADD COLUMN IF NOT EXISTS approval_level text;

CREATE TABLE IF NOT EXISTS public.company_approval_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Requisitions above this amount also need a final approval; NULL = one level.
  pr_final_approval_above numeric(15,2)
    CHECK (pr_final_approval_above IS NULL OR pr_final_approval_above >= 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_approval_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users read approval settings" ON public.company_approval_settings;
CREATE POLICY "Company users read approval settings" ON public.company_approval_settings
  FOR SELECT TO authenticated
  USING (public.can_access_company(company_id) OR public.is_admin(auth.uid()));
-- Written only through save_company_approval_settings.

-- The requisition's value: its lines, or the stored total when it has none.
CREATE OR REPLACE FUNCTION public.pr_amount(p_pr_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT SUM(i.estimated_total_price) FROM public.pr_items i WHERE i.pr_id = p_pr_id),
    (SELECT pr.total_estimated_amount FROM public.purchase_requisitions pr WHERE pr.id = p_pr_id),
    0)
$$;

CREATE OR REPLACE FUNCTION public.pr_final_threshold(p_company_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.pr_final_approval_above FROM public.company_approval_settings s WHERE s.company_id = p_company_id
$$;

CREATE OR REPLACE FUNCTION public.pr_status_of(p_pr_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT status::text FROM public.purchase_requisitions WHERE id = p_pr_id $$;

-- Final approval: a manager or finance company approver within their limit,
-- the company's manager, or an admin.
CREATE OR REPLACE FUNCTION public.has_pr_final_authority(p_user uuid, p_company_id uuid, p_amount numeric)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user IS NOT NULL AND (
    public.is_admin(p_user)
    OR (p_company_id IS NOT NULL
        AND public.user_in_company(p_user, p_company_id)
        AND (public.is_company_manager(p_user, p_company_id)
             OR EXISTS (
               SELECT 1 FROM public.company_approvers ca
                WHERE ca.user_id = p_user
                  AND ca.company_id = p_company_id
                  AND ca.approval_level::text IN ('manager', 'finance')
                  AND (ca.can_approve_up_to_amount IS NULL OR p_amount <= ca.can_approve_up_to_amount))))
  )
$$;

-- Why p_user can't approve or reject this requisition now (NULL = they can).
CREATE OR REPLACE FUNCTION public.pr_approval_block_reason_for(p_user uuid, p_pr_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pr public.purchase_requisitions%ROWTYPE;
  v_admin boolean;
  v_amount numeric;
BEGIN
  IF p_user IS NULL THEN RETURN 'Sign in to approve requisitions'; END IF;
  SELECT * INTO v_pr FROM public.purchase_requisitions WHERE id = p_pr_id;
  IF NOT FOUND THEN RETURN 'Requisition not found'; END IF;
  IF v_pr.status::text NOT IN ('submitted', 'pending_approval') THEN
    RETURN 'This requisition isn''t waiting for approval';
  END IF;

  v_admin := public.is_admin(p_user);
  v_amount := public.pr_amount(p_pr_id);
  IF NOT v_admin AND v_pr.requested_by = p_user THEN
    RETURN 'You raised this requisition, so someone else must approve it';
  END IF;

  IF v_pr.status::text = 'submitted' THEN
    IF NOT public.has_approval_authority(p_user, v_pr.company_id, 'department_head', v_amount) THEN
      RETURN 'You don''t have approval rights for requisitions in this company, or the amount is above your limit';
    END IF;
  ELSE
    IF NOT v_admin AND v_pr.first_approved_by = p_user THEN
      RETURN 'You gave the first approval, so a different person must give the final approval';
    END IF;
    IF NOT public.has_pr_final_authority(p_user, v_pr.company_id, v_amount) THEN
      RETURN 'The final approval needs a manager or finance approver whose limit covers this amount';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.pr_approval_block_reason(p_pr_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.pr_approval_block_reason_for(auth.uid(), p_pr_id) $$;

-- What the requisition screen shows about approval.
CREATE OR REPLACE FUNCTION public.pr_approval_info(p_pr_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pr public.purchase_requisitions%ROWTYPE;
  v_amount numeric;
  v_threshold numeric;
BEGIN
  SELECT * INTO v_pr FROM public.purchase_requisitions WHERE id = p_pr_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = 'P0002'; END IF;
  IF auth.uid() IS NULL OR NOT (
       v_pr.requested_by = auth.uid()
       OR public.is_admin(auth.uid())
       OR (v_pr.company_id IS NOT NULL AND public.user_in_company(auth.uid(), v_pr.company_id))) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  v_amount := public.pr_amount(p_pr_id);
  v_threshold := public.pr_final_threshold(v_pr.company_id);
  RETURN jsonb_build_object(
    'stage', CASE v_pr.status::text WHEN 'submitted' THEN 'department_head' WHEN 'pending_approval' THEN 'final' END,
    'amount', v_amount,
    'final_threshold', v_threshold,
    'needs_final', v_threshold IS NOT NULL AND v_amount > v_threshold,
    'block_reason', public.pr_approval_block_reason_for(auth.uid(), p_pr_id),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'action', a.action, 'level', a.approval_level, 'comments', a.comments, 'at', a.created_at,
               'approver', COALESCE(p.full_name, p.email, 'Unknown')) ORDER BY a.created_at)
        FROM public.pr_approvals a
        LEFT JOIN public.profiles p ON p.user_id = a.approver_id
       WHERE a.pr_id = p_pr_id), '[]'::jsonb)
  );
END;
$$;

-- Approve or reject at the stage the requisition is at. Returns the new status.
DROP FUNCTION IF EXISTS public.decide_purchase_requisition(uuid, boolean, text);
CREATE FUNCTION public.decide_purchase_requisition(p_pr_id uuid, p_approve boolean, p_comments text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pr public.purchase_requisitions%ROWTYPE;
  v_reason text;
  v_comments text := NULLIF(btrim(COALESCE(p_comments, '')), '');
  v_stage text;
  v_threshold numeric;
BEGIN
  SELECT * INTO v_pr FROM public.purchase_requisitions WHERE id = p_pr_id FOR UPDATE;
  v_reason := public.pr_approval_block_reason_for(v_uid, p_pr_id);
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
  IF NOT p_approve AND v_comments IS NULL THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;

  v_stage := CASE v_pr.status::text WHEN 'submitted' THEN 'department_head' ELSE 'final' END;

  IF NOT p_approve THEN
    UPDATE public.purchase_requisitions
       SET status = 'rejected', rejection_reason = v_comments, updated_at = now()
     WHERE id = p_pr_id;
    INSERT INTO public.pr_approvals (pr_id, approver_id, action, comments, approval_level)
    VALUES (p_pr_id, v_uid, 'rejected', v_comments, v_stage);
    RETURN 'rejected';
  END IF;

  INSERT INTO public.pr_approvals (pr_id, approver_id, action, comments, approval_level)
  VALUES (p_pr_id, v_uid, 'approved', v_comments, v_stage);

  v_threshold := public.pr_final_threshold(v_pr.company_id);
  IF v_stage = 'department_head' AND v_threshold IS NOT NULL AND public.pr_amount(p_pr_id) > v_threshold THEN
    UPDATE public.purchase_requisitions
       SET status = 'pending_approval', first_approved_by = v_uid, first_approved_at = now(), updated_at = now()
     WHERE id = p_pr_id;
    RETURN 'pending_approval';
  END IF;

  UPDATE public.purchase_requisitions
     SET status = 'approved',
         approved_by = v_uid,
         approved_date = now(),
         first_approved_by = COALESCE(first_approved_by, v_uid),
         first_approved_at = COALESCE(first_approved_at, now()),
         updated_at = now()
   WHERE id = p_pr_id;
  RETURN 'approved';
END;
$$;

CREATE OR REPLACE FUNCTION public.pr_has_lines(p_pr_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.pr_items WHERE pr_id = p_pr_id AND quantity > 0) $$;

-- Signed-in users submit, withdraw to draft and cancel; approving and
-- rejecting go through decide_purchase_requisition, whose statements run as the
-- function owner and pass. (INVOKER, so current_user is the caller.)
CREATE OR REPLACE FUNCTION public.enforce_pr_status_flow()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_from text := OLD.status::text;
  v_to text := NEW.status::text;
BEGIN
  IF v_from = v_to OR current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;

  IF v_from = 'draft' AND v_to = 'submitted' THEN
    IF NOT public.pr_has_lines(NEW.id) THEN
      RAISE EXCEPTION 'Add at least one line before submitting';
    END IF;
    NEW.first_approved_by := NULL;
    NEW.first_approved_at := NULL;
    RETURN NEW;
  END IF;
  IF v_from = 'submitted' AND v_to = 'draft' THEN RETURN NEW; END IF;
  IF v_to = 'cancelled' AND v_from IN ('draft', 'submitted', 'pending_approval') THEN RETURN NEW; END IF;
  IF v_to IN ('approved', 'rejected', 'pending_approval') THEN
    RAISE EXCEPTION 'Use Approve or Reject on the requisition; the status can''t be set directly' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'A requisition can''t go from % to %', replace(v_from, '_', ' '), replace(v_to, '_', ' ');
END;
$$;

DROP TRIGGER IF EXISTS trg_pr_status_flow ON public.purchase_requisitions;
CREATE TRIGGER trg_pr_status_flow
  BEFORE UPDATE OF status ON public.purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pr_status_flow();

-- Lines are frozen once the requisition is submitted, so the amount that was
-- approved is the amount that is bought.
CREATE OR REPLACE FUNCTION public.lock_submitted_pr_items()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN COALESCE(NEW, OLD); END IF;
  IF COALESCE(public.pr_status_of(COALESCE(OLD.pr_id, NEW.pr_id)), 'draft') <> 'draft'
     OR (TG_OP = 'UPDATE' AND NEW.pr_id IS DISTINCT FROM OLD.pr_id
         AND COALESCE(public.pr_status_of(NEW.pr_id), 'draft') <> 'draft') THEN
    RAISE EXCEPTION 'This requisition has been submitted, so its lines can''t change' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_submitted_pr_items ON public.pr_items;
CREATE TRIGGER trg_lock_submitted_pr_items
  BEFORE INSERT OR UPDATE OR DELETE ON public.pr_items
  FOR EACH ROW EXECUTE FUNCTION public.lock_submitted_pr_items();

-- Requisitions left at pending_approval by the old single-level flow go back
-- to the first level.
UPDATE public.purchase_requisitions
   SET status = 'submitted'
 WHERE status = 'pending_approval' AND first_approved_by IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Company approvers and limits (Admin › Companies)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.company_approval_setup(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators manage approvers' USING ERRCODE = '42501';
  END IF;
  SELECT id, name, hod_user_id, manager_user_id INTO c FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Company not found' USING ERRCODE = 'P0002'; END IF;

  RETURN jsonb_build_object(
    'company_id', c.id,
    'company_name', c.name,
    'pr_final_approval_above', public.pr_final_threshold(c.id),
    'hod', (SELECT jsonb_build_object('user_id', p.user_id, 'full_name', p.full_name, 'email', p.email)
              FROM public.profiles p WHERE p.user_id = c.hod_user_id),
    'manager', (SELECT jsonb_build_object('user_id', p.user_id, 'full_name', p.full_name, 'email', p.email)
                  FROM public.profiles p WHERE p.user_id = c.manager_user_id),
    'approvers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', ca.id, 'user_id', ca.user_id, 'full_name', p.full_name, 'email', p.email,
               'approval_level', ca.approval_level, 'department', ca.department,
               'is_primary', COALESCE(ca.is_primary, false),
               'can_approve_up_to_amount', ca.can_approve_up_to_amount,
               'deactivated', p.deactivated_at IS NOT NULL,
               'in_company', public.user_in_company(ca.user_id, c.id))
             ORDER BY ca.approval_level, p.full_name)
        FROM public.company_approvers ca
        LEFT JOIN public.profiles p ON p.user_id = ca.user_id
       WHERE ca.company_id = c.id), '[]'::jsonb),
    'candidates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('user_id', p.user_id, 'full_name', p.full_name, 'email', p.email)
             ORDER BY p.full_name)
        FROM public.profiles p
       WHERE p.deactivated_at IS NULL
         AND (p.company_id = c.id
              OR EXISTS (SELECT 1 FROM public.user_company_access a
                          WHERE a.user_id = p.user_id AND a.company_id = c.id))), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_approver(
  p_id uuid,
  p_company_id uuid,
  p_user_id uuid,
  p_level text,
  p_limit numeric DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_is_primary boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_department text := NULLIF(btrim(COALESCE(p_department, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators manage approvers' USING ERRCODE = '42501';
  END IF;
  IF p_level IS NULL OR p_level NOT IN ('hod', 'manager', 'finance', 'procurement', 'custom') THEN
    RAISE EXCEPTION 'Unknown approval level %', p_level;
  END IF;
  IF p_limit IS NOT NULL AND p_limit < 0 THEN
    RAISE EXCEPTION 'The limit can''t be negative';
  END IF;
  IF NOT public.user_in_company(p_user_id, p_company_id)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id AND deactivated_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Choose an active user of this company';
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_approvers
              WHERE company_id = p_company_id AND user_id = p_user_id
                AND approval_level::text = p_level
                AND department IS NOT DISTINCT FROM v_department
                AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'This person is already an approver at that level';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.company_approvers (company_id, user_id, approval_level, department, is_primary,
                                          can_approve_up_to_amount, created_by)
    VALUES (p_company_id, p_user_id, p_level::public.approval_level_type, v_department,
            COALESCE(p_is_primary, false), p_limit, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.company_approvers
       SET user_id = p_user_id,
           approval_level = p_level::public.approval_level_type,
           department = v_department,
           is_primary = COALESCE(p_is_primary, false),
           can_approve_up_to_amount = p_limit,
           updated_at = now()
     WHERE id = p_id AND company_id = p_company_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Approver not found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_company_approver(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators manage approvers' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.company_approvers WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_approval_settings(p_company_id uuid, p_pr_final_approval_above numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators manage approval settings' USING ERRCODE = '42501';
  END IF;
  IF p_pr_final_approval_above IS NOT NULL AND p_pr_final_approval_above < 0 THEN
    RAISE EXCEPTION 'The amount can''t be negative';
  END IF;
  INSERT INTO public.company_approval_settings (company_id, pr_final_approval_above, updated_by, updated_at)
  VALUES (p_company_id, p_pr_final_approval_above, auth.uid(), now())
  ON CONFLICT (company_id) DO UPDATE
    SET pr_final_approval_above = EXCLUDED.pr_final_approval_above,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A requisition's bill of materials belongs to its company
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_pr_bom_company()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.bom_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.bill_of_materials b
        WHERE b.id = NEW.bom_id
          AND b.company_id IS NOT NULL
          AND b.company_id IS DISTINCT FROM NEW.company_id) THEN
    RAISE EXCEPTION 'That bill of materials belongs to another company';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_pr_bom_company ON public.purchase_requisitions;
CREATE TRIGGER trg_check_pr_bom_company
  BEFORE INSERT OR UPDATE OF bom_id, company_id ON public.purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.check_pr_bom_company();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Purchase orders emailed to the supplier
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_emailed_to text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Blanket-PO releases follow their purchase order
-- ─────────────────────────────────────────────────────────────────────────────
-- A PO cancelled after part delivery closes its release as completed, so the
-- delivered part stays drawn down.
CREATE OR REPLACE FUNCTION public.bpo_release_status_for_po(p_po_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE po.status::text
           WHEN 'approved' THEN 'approved'
           WHEN 'sent' THEN 'sent'
           WHEN 'acknowledged' THEN 'sent'
           WHEN 'partially_received' THEN 'received'
           WHEN 'completed' THEN 'completed'
           WHEN 'cancelled' THEN
             CASE WHEN EXISTS (SELECT 1 FROM public.po_items i
                                WHERE i.po_id = po.id AND COALESCE(i.quantity_received, 0) > 0)
                  THEN 'completed' ELSE 'cancelled' END
         END
    FROM public.purchase_orders po
   WHERE po.id = p_po_id
$$;

CREATE OR REPLACE FUNCTION public.sync_bpo_releases_for_po(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status text := public.bpo_release_status_for_po(p_po_id);
  v_po public.purchase_orders%ROWTYPE;
BEGIN
  IF v_status IS NULL THEN RETURN; END IF;
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;

  UPDATE public.blanket_po_releases r
     SET release_status = v_status::public.bpo_release_status,
         actual_delivery_date = CASE WHEN v_status = 'completed'
                                     THEN COALESCE(r.actual_delivery_date, v_po.actual_delivery_date, CURRENT_DATE)
                                     ELSE r.actual_delivery_date END,
         decision_notes = CASE
           WHEN v_status = 'cancelled' THEN
             concat_ws(' ', NULLIF(r.decision_notes, ''),
                       format('Purchase order %s was cancelled; its value is back on the contract.', v_po.po_number))
           WHEN v_status = 'completed' AND v_po.status::text = 'cancelled' THEN
             concat_ws(' ', NULLIF(r.decision_notes, ''),
                       format('Purchase order %s was closed after part delivery.', v_po.po_number))
           ELSE r.decision_notes END,
         updated_at = now()
   WHERE r.po_id = p_po_id
     AND r.release_status::text <> 'cancelled'
     AND r.release_status::text <> v_status;

  IF v_status = 'cancelled' THEN
    -- Re-run the line trigger so the items' released quantities drop this release.
    UPDATE public.blanket_po_release_items ri
       SET quantity_approved = ri.quantity_approved
     WHERE ri.release_id IN (SELECT id FROM public.blanket_po_releases WHERE po_id = p_po_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_bpo_release_from_po()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.sync_bpo_releases_for_po(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bpo_release_from_po ON public.purchase_orders;
CREATE TRIGGER trg_sync_bpo_release_from_po
  AFTER UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_bpo_release_from_po();

-- Bring existing releases up to date with their POs.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT po_id FROM public.blanket_po_releases WHERE po_id IS NOT NULL LOOP
    PERFORM public.sync_bpo_releases_for_po(r.po_id);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.decide_purchase_requisition(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_purchase_requisition(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.pr_approval_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pr_approval_info(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pr_approval_block_reason(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pr_approval_block_reason(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pr_approval_block_reason_for(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_pr_final_authority(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pr_status_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pr_has_lines(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.company_approval_setup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_approval_setup(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.save_company_approver(uuid, uuid, uuid, text, numeric, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_company_approver(uuid, uuid, uuid, text, numeric, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_company_approver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_company_approver(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.save_company_approval_settings(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_company_approval_settings(uuid, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_bpo_releases_for_po(uuid) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN (
--        'pr_approval_info', 'has_pr_final_authority', 'company_approval_setup', 'save_company_approver',
--        'remove_company_approver', 'save_company_approval_settings', 'sync_bpo_releases_for_po')) AS functions,  -- 7
--     (SELECT count(*) FROM pg_trigger WHERE tgname IN (
--        'trg_pr_status_flow', 'trg_lock_submitted_pr_items', 'trg_check_pr_bom_company', 'trg_sync_bpo_release_from_po')) AS triggers,  -- 4
--     (SELECT count(*) FROM public.purchase_requisitions WHERE status IN ('submitted', 'pending_approval')) AS requisitions_waiting,
--     (SELECT count(*) FROM public.blanket_po_releases r JOIN public.purchase_orders po ON po.id = r.po_id
--       WHERE r.release_status::text <> public.bpo_release_status_for_po(po.id)) AS releases_out_of_step;  -- 0
-- ─────────────────────────────────────────────────────────────────────────────
