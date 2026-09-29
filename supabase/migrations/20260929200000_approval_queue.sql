-- Approval console: a real queue, and decisions that save.
--
-- The console's list came from get_approval_console, which trusted the user id
-- sent by the browser, showed non-admins what they had submitted rather than
-- what waited for them, and referred to columns that don't exist; its Approve
-- and Reject buttons saved nothing.
--
-- approval_queue('to_decide') lists what the signed-in user can decide now,
-- using each module's own rules (the same checks as its screen):
--   purchase orders, requisitions, blanket-PO releases, PO amendments,
--   supplier registrations, material issue notes, stock transfers,
--   customer POs, social-media access and production receipts.
-- approval_queue('submitted') lists what they sent that is still waiting.
-- decide_approval_item() approves or rejects through the module's own function,
-- so the console can never do more than the module's screen allows.
--
-- Safe to run more than once.

-- Customer POs were approved by a direct update from the screen; this is the
-- database version (admins of the company, with the approval history).
CREATE OR REPLACE FUNCTION public.decide_customer_po(p_cpo_id uuid, p_approve boolean, p_comments text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.customer_purchase_orders%ROWTYPE;
  v_comments text := NULLIF(btrim(COALESCE(p_comments, '')), '');
BEGIN
  SELECT * INTO c FROM public.customer_purchase_orders WHERE id = p_cpo_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_company(c.company_id) OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin of this company can approve customer POs' USING ERRCODE = '42501';
  END IF;
  IF c.status <> 'pending_approval' THEN RAISE EXCEPTION 'This customer PO isn''t waiting for approval'; END IF;
  IF NOT p_approve AND v_comments IS NULL THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;
  UPDATE public.customer_purchase_orders
     SET status = CASE WHEN p_approve THEN 'confirmed' ELSE 'rejected' END,
         approved_by = auth.uid(), approved_date = now(), approval_comments = v_comments,
         pending_approval = false, updated_at = now()
   WHERE id = c.id;
  INSERT INTO public.customer_po_approvals (cpo_id, approver_id, action, comments)
  VALUES (c.id, auth.uid(), CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, v_comments);
  RETURN CASE WHEN p_approve THEN 'confirmed' ELSE 'rejected' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.approval_queue(p_scope text DEFAULT 'to_decide')
RETURNS TABLE (
  item_type text,
  item_id uuid,
  reference text,
  title text,
  amount numeric,
  currency text,
  company_id uuid,
  submitted_at timestamptz,
  submitted_by uuid,
  stage text,
  view_url text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_decide boolean := COALESCE(p_scope, 'to_decide') <> 'submitted';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;

  RETURN QUERY
  WITH items AS (
    -- Purchase orders
    SELECT 'po'::text AS t, po.id, po.po_number AS ref, COALESCE(s.name, 'Purchase order') AS ttl,
           COALESCE(po.final_amount, po.total_amount) AS amt, po.currency AS cur, po.company_id AS co,
           po.updated_at AS at, po.created_by AS who,
           CASE po.status::text WHEN 'pending_approval' THEN 'Merchandiser approval' ELSE 'Department head approval' END AS stg,
           '/procurement/purchase-order' AS url,
           (public.po_approval_block_reason_for(v_uid, po.id, NULL) IS NULL) AS can_decide
      FROM public.purchase_orders po
      LEFT JOIN public.suppliers s ON s.id = po.supplier_id
     WHERE po.status::text IN ('pending_approval', 'pending_dept_head_approval')
    UNION ALL
    -- Purchase requisitions
    SELECT 'pr', pr.id, pr.pr_number, pr.title, public.pr_amount(pr.id), 'LKR', pr.company_id,
           pr.updated_at, pr.requested_by,
           CASE pr.status::text WHEN 'submitted' THEN 'Department head approval' ELSE 'Final approval' END,
           '/procurement/purchase-requisition',
           (public.pr_approval_block_reason_for(v_uid, pr.id) IS NULL)
      FROM public.purchase_requisitions pr
     WHERE pr.status::text IN ('submitted', 'pending_approval')
    UNION ALL
    -- Blanket PO releases
    SELECT 'bpo_release', r.id, r.release_number, 'Release against ' || b.bpo_number, r.total_amount, b.currency, b.company_id,
           r.created_at, r.requested_by, 'Release approval', '/procurement/blanket-po',
           (public.bpo_release_block_reason(r.id) IS NULL)
      FROM public.blanket_po_releases r
      JOIN public.blanket_purchase_orders b ON b.id = r.bpo_id
     WHERE r.release_status::text = 'submitted'
    UNION ALL
    -- PO amendments
    SELECT 'po_amendment', a.id, a.amendment_number, replace(a.amendment_type, '_', ' ') || ' on ' || po.po_number, NULL::numeric,
           po.currency, po.company_id, a.created_at, a.created_by, 'Amendment approval', '/procurement/po-amendment',
           (public.po_amendment_block_reason(a.id) IS NULL)
      FROM public.po_amendments a
      JOIN public.purchase_orders po ON po.id = a.po_id
     WHERE a.status = 'pending'
    UNION ALL
    -- Supplier registrations
    SELECT 'supplier_registration', sr.id, COALESCE(sr.supplier_data->>'supplier_name', 'Registration'),
           CASE WHEN sr.request_type = 'self_service' THEN 'Public supplier application' ELSE 'Supplier registration' END,
           NULL, NULL, sr.company_id, COALESCE(sr.submitted_at, sr.created_at), sr.created_by,
           'Registration approval', '/sourcing/supplier-registration',
           (public.is_admin(v_uid) AND (sr.company_id IS NULL OR public.can_access_company(sr.company_id)))
      FROM public.supplier_registration_requests sr
     WHERE sr.status = 'pending_approval'
    UNION ALL
    -- Material issue notes
    SELECT 'min', n.id, n.min_number, 'Issue to ' || n.issued_to, n.total_value, 'LKR', n.company_id,
           COALESCE(n.submitted_at, n.created_at), COALESCE(n.submitted_by, n.created_by), 'Issue approval',
           '/warehouse/material-issue',
           (public.is_min_approver(v_uid) AND public.can_access_company(n.company_id))
      FROM public.material_issue_notes n
     WHERE n.status = 'pending_approval'
    UNION ALL
    -- Stock transfers
    SELECT 'stock_transfer', t.id, t.transfer_number, 'Stock transfer (' || t.transfer_type || ')', NULL, NULL, t.company_id,
           t.updated_at, COALESCE(t.requested_by, t.created_by), 'Transfer approval', '/warehouse/stock-transfer',
           (public.stock_transfer_block_reason(t.id) IS NULL)
      FROM public.stock_transfer_requests t
     WHERE t.status = 'pending_approval'
    UNION ALL
    -- Customer POs
    SELECT 'customer_po', c.id, c.cpo_number, COALESCE(cu.customer_name, 'Customer PO'), c.total_amount, 'LKR', c.company_id,
           c.updated_at, c.created_by, 'Customer PO approval', '/tuh-modules/customer-po/' || c.id,
           (public.is_admin(v_uid) AND public.can_access_company(c.company_id))
      FROM public.customer_purchase_orders c
      LEFT JOIN public.customers cu ON cu.id = c.customer_id
     WHERE c.status = 'pending_approval'
    UNION ALL
    -- Social-media access
    SELECT 'social_media_access', sa.id, acc.account_name, 'Access (' || sa.access_level || ') for '
             || COALESCE((SELECT COALESCE(p.full_name, p.email) FROM public.profiles p WHERE p.user_id = sa.user_id), 'a user'),
           NULL, NULL, sa.company_id, COALESCE(sa.requested_at, sa.created_at), sa.requested_by, 'Access approval',
           '/social-media/access',
           (public.social_media_access_block_reason(sa.id) IS NULL)
      FROM public.social_media_access sa
      JOIN public.social_media_accounts acc ON acc.id = sa.account_id
     WHERE sa.status = 'pending'
    UNION ALL
    -- Production receipts
    SELECT 'production_receipt', b.id, b.batch_number, COALESCE(fg.product_name, 'Production receipt') || ' × ' || b.quantity,
           b.production_cost, 'LKR', b.company_id, b.created_at, b.created_by, 'Receipt approval', '/tuh-modules/finished-goods',
           (public.is_admin(v_uid) AND public.can_access_company(b.company_id))
      FROM public.finished_goods_batches b
      LEFT JOIN public.finished_goods fg ON fg.id = b.finished_good_id
     WHERE b.approval_status = 'pending'
  )
  SELECT i.t, i.id, i.ref, i.ttl, i.amt, i.cur, i.co, i.at, i.who, i.stg, i.url
    FROM items i
   WHERE (v_decide AND i.can_decide)
      OR (NOT v_decide AND i.who = v_uid AND (i.co IS NULL OR public.can_access_company(i.co)))
   ORDER BY i.at DESC NULLS LAST
   LIMIT 300;
END;
$$;

-- Approve or reject one item through its module's own rules.
CREATE OR REPLACE FUNCTION public.decide_approval_item(p_type text, p_id uuid, p_approve boolean, p_comments text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_comments text := NULLIF(btrim(COALESCE(p_comments, '')), '');
  v_reason text;
  v_sr public.supplier_registration_requests%ROWTYPE;
  v_b public.finished_goods_batches%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF NOT p_approve AND v_comments IS NULL THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;

  CASE p_type
    WHEN 'po' THEN
      PERFORM public.decide_po_approval(p_id, p_approve, v_comments);
    WHEN 'pr' THEN
      RETURN public.decide_purchase_requisition(p_id, p_approve, v_comments);
    WHEN 'bpo_release' THEN
      PERFORM public.decide_bpo_release(p_id, p_approve, v_comments);
    WHEN 'po_amendment' THEN
      PERFORM public.decide_po_amendment(p_id, p_approve, v_comments);
    WHEN 'social_media_access' THEN
      RETURN public.decide_social_media_access(p_id, p_approve, v_comments);
    WHEN 'customer_po' THEN
      RETURN public.decide_customer_po(p_id, p_approve, v_comments);
    WHEN 'min' THEN
      IF p_approve THEN PERFORM public.approve_material_issue(p_id);
      ELSE PERFORM public.reject_material_issue(p_id, v_comments);
      END IF;
    WHEN 'supplier_registration' THEN
      IF p_approve THEN
        -- Registrations that match an existing supplier are decided on their own screen (link or reason).
        PERFORM public.approve_supplier_registration(p_id, v_comments, NULL, NULL);
      ELSE
        SELECT * INTO v_sr FROM public.supplier_registration_requests WHERE id = p_id FOR UPDATE;
        IF NOT FOUND OR NOT public.is_admin(v_uid) THEN
          RAISE EXCEPTION 'Only an administrator can reject supplier registrations' USING ERRCODE = '42501';
        END IF;
        IF v_sr.status <> 'pending_approval' THEN RAISE EXCEPTION 'This registration isn''t waiting for approval'; END IF;
        UPDATE public.supplier_registration_requests
           SET status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = v_comments
         WHERE id = p_id;
        INSERT INTO public.supplier_approval_workflow (registration_request_id, stage, status, completed_by, completed_at, notes)
        VALUES (p_id, 'rejected', 'completed', v_uid, now(), v_comments);
      END IF;
    WHEN 'stock_transfer' THEN
      -- Statements here run as the function owner, so the transfer's own
      -- trigger checks are repeated explicitly.
      IF p_approve THEN
        v_reason := public.stock_transfer_block_reason(p_id);
        IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
        UPDATE public.stock_transfer_requests
           SET status = 'approved', approved_by = v_uid, approved_date = now(), updated_at = now()
         WHERE id = p_id AND status = 'pending_approval';
      ELSE
        IF NOT public.can_approve_stock_moves(v_uid)
           OR NOT public.can_access_company((SELECT company_id FROM public.stock_transfer_requests WHERE id = p_id)) THEN
          RAISE EXCEPTION 'Only a warehouse manager or admin can reject transfers' USING ERRCODE = '42501';
        END IF;
        PERFORM public.release_stock_transfer(p_id);
        UPDATE public.stock_transfer_requests
           SET status = 'cancelled', notes = concat_ws(E'\n', NULLIF(notes, ''), 'Rejected: ' || v_comments), updated_at = now()
         WHERE id = p_id AND status = 'pending_approval';
      END IF;
      IF NOT FOUND THEN RAISE EXCEPTION 'This transfer isn''t waiting for approval'; END IF;
    WHEN 'production_receipt' THEN
      SELECT * INTO v_b FROM public.finished_goods_batches WHERE id = p_id FOR UPDATE;
      IF NOT FOUND OR NOT public.is_admin(v_uid) OR NOT public.can_access_company(v_b.company_id) THEN
        RAISE EXCEPTION 'Only an admin of this company can approve production receipts' USING ERRCODE = '42501';
      END IF;
      IF v_b.approval_status <> 'pending' THEN RAISE EXCEPTION 'This receipt isn''t waiting for approval'; END IF;
      UPDATE public.finished_goods_batches
         SET approval_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
             approved_by = v_uid, approved_date = now(),
             approval_comments = CASE WHEN p_approve THEN v_comments END,
             rejection_reason = CASE WHEN p_approve THEN NULL ELSE v_comments END,
             updated_at = now()
       WHERE id = p_id;
      INSERT INTO public.finished_goods_batch_approvals (batch_id, approver_id, action, comments)
      VALUES (p_id, v_uid, CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, v_comments);
    ELSE
      RAISE EXCEPTION 'Unknown approval type %', p_type;
  END CASE;
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END;
$$;

REVOKE ALL ON FUNCTION public.approval_queue(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approval_queue(text) TO authenticated;
REVOKE ALL ON FUNCTION public.decide_approval_item(text, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_approval_item(text, uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.decide_customer_po(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_customer_po(uuid, boolean, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying (run while signed in to the app is not needed):
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN ('approval_queue', 'decide_approval_item', 'decide_customer_po')) AS functions;  -- 3
-- ─────────────────────────────────────────────────────────────────────────────
