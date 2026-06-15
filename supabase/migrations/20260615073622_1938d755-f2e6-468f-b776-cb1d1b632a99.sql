
-- ============================================================
-- Material Issue Note (MIN) — Admin approval workflow
-- ISO 9001 §8.5.1 + SAP MIGO/261 segregation of duties
-- Stock is NOT moved until an admin (or super_admin) approves.
-- ============================================================

-- 1. Add submission / rejection audit columns (approved_by / approved_date already exist)
ALTER TABLE public.material_issue_notes
  ADD COLUMN IF NOT EXISTS submitted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by      uuid,
  ADD COLUMN IF NOT EXISTS rejected_at       timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by       uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason  text;

-- 2. Helper: admin (or super_admin) check usable from RPCs
CREATE OR REPLACE FUNCTION public.is_min_approver(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'super_admin'::app_role);
$$;

-- 3. Submit-for-approval RPC: draft -> pending_approval
CREATE OR REPLACE FUNCTION public.submit_material_issue_for_approval(p_min_id uuid)
RETURNS public.material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min public.material_issue_notes;
  v_uid uuid := auth.uid();
  v_item_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_min FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note % not found', p_min_id;
  END IF;

  IF v_min.status NOT IN ('draft','pending_approval') THEN
    RAISE EXCEPTION 'MIN % cannot be submitted from status %', v_min.min_number, v_min.status;
  END IF;

  SELECT COUNT(*) INTO v_item_count FROM public.material_issue_items WHERE min_id = p_min_id;
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Cannot submit an empty Material Issue Note';
  END IF;

  UPDATE public.material_issue_notes
     SET status        = 'pending_approval',
         submitted_at  = COALESCE(submitted_at, now()),
         submitted_by  = COALESCE(submitted_by, v_uid),
         updated_at    = now()
   WHERE id = p_min_id
  RETURNING * INTO v_min;

  RETURN v_min;
END;
$$;

-- 4. Approve RPC: admin-only, deducts stock atomically per line
CREATE OR REPLACE FUNCTION public.approve_material_issue(p_min_id uuid)
RETURNS public.material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min  public.material_issue_notes;
  v_uid  uuid := auth.uid();
  v_item RECORD;
  v_bin_alloc_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_min_approver(v_uid) THEN
    RAISE EXCEPTION 'Only admins can approve Material Issue Notes (ISO 9001 §8.5.1 segregation of duties)';
  END IF;

  SELECT * INTO v_min FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note % not found', p_min_id;
  END IF;

  IF v_min.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'MIN % is not pending approval (current status: %)', v_min.min_number, v_min.status;
  END IF;

  IF v_min.created_by IS NOT NULL AND v_min.created_by = v_uid THEN
    RAISE EXCEPTION 'Requesters cannot approve their own Material Issue Note (segregation of duties)';
  END IF;

  IF v_min.location_id IS NULL THEN
    RAISE EXCEPTION 'MIN % has no issue location set; cannot deduct stock', v_min.min_number;
  END IF;

  -- Deduct stock for each line, in line order, atomically.
  FOR v_item IN
    SELECT * FROM public.material_issue_items
    WHERE min_id = p_min_id
    ORDER BY line_number NULLS LAST, created_at
  LOOP
    -- Optional reservation drawdown
    IF v_item.from_reservation = true AND v_item.reservation_id IS NOT NULL THEN
      PERFORM public.update_reservation_on_issue(
        p_reservation_id  => v_item.reservation_id,
        p_quantity_issued => v_item.quantity_issued
      );
    END IF;

    v_bin_alloc_id := NULL;
    IF v_item.reservation_id IS NOT NULL THEN
      SELECT bin_allocation_id INTO v_bin_alloc_id
      FROM public.warehouse_item_reservations
      WHERE id = v_item.reservation_id;
    END IF;

    PERFORM public.process_material_issue_stock_update(
      p_item_id                    => v_item.item_id,
      p_quantity_issued            => v_item.quantity_issued,
      p_location_id                => v_min.location_id,
      p_bin_allocation_id          => v_bin_alloc_id,
      p_min_id                     => p_min_id,
      p_min_number                 => v_min.min_number,
      p_secondary_quantity_issued  => v_item.secondary_quantity_issued
    );
  END LOOP;

  UPDATE public.material_issue_notes
     SET status        = 'approved',
         approved_by   = v_uid,
         approved_date = now(),
         updated_at    = now()
   WHERE id = p_min_id
  RETURNING * INTO v_min;

  RETURN v_min;
END;
$$;

-- 5. Reject RPC: admin-only, records reason; no stock movement
CREATE OR REPLACE FUNCTION public.reject_material_issue(p_min_id uuid, p_reason text)
RETURNS public.material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min public.material_issue_notes;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_min_approver(v_uid) THEN
    RAISE EXCEPTION 'Only admins can reject Material Issue Notes';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  SELECT * INTO v_min FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note % not found', p_min_id;
  END IF;
  IF v_min.status NOT IN ('pending_approval','draft') THEN
    RAISE EXCEPTION 'MIN % cannot be rejected from status %', v_min.min_number, v_min.status;
  END IF;

  UPDATE public.material_issue_notes
     SET status            = 'rejected',
         rejected_by       = v_uid,
         rejected_at       = now(),
         rejection_reason  = btrim(p_reason),
         updated_at        = now()
   WHERE id = p_min_id
  RETURNING * INTO v_min;

  RETURN v_min;
END;
$$;

-- 6. Guard trigger — block direct UPDATEs that flip status to 'approved' outside the RPC.
-- Mirrors enforce_grn_allocation_on_approval pattern.
CREATE OR REPLACE FUNCTION public.enforce_min_approval_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND COALESCE(OLD.status,'') <> 'approved' THEN
    -- The approve_material_issue RPC stamps approved_by AND approved_date in the same UPDATE.
    -- Any other path leaves at least one of them NULL.
    IF NEW.approved_by IS NULL OR NEW.approved_date IS NULL THEN
      RAISE EXCEPTION 'ISO 9001 §8.5.1: Material Issue Notes must be approved via approve_material_issue() RPC';
    END IF;
    -- And the approver must actually be an admin.
    IF NOT public.is_min_approver(NEW.approved_by) THEN
      RAISE EXCEPTION 'Only admins may approve Material Issue Notes';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_min_approval_path ON public.material_issue_notes;
CREATE TRIGGER trg_enforce_min_approval_path
  BEFORE UPDATE ON public.material_issue_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_approval_path();

-- 7. Grants
GRANT EXECUTE ON FUNCTION public.submit_material_issue_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_material_issue(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_material_issue(uuid, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_min_approver(uuid)                    TO authenticated;

-- 8. Approval Console — surface pending MINs (both signatures)
CREATE OR REPLACE FUNCTION public.get_approval_console(user_id uuid DEFAULT auth.uid(), p_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, type text, title text, description text, priority_text text, status_text text, assigned_to uuid, assigned_to_name text, stage text, stage_order integer, created_at timestamp with time zone, amount numeric, currency text, entity_id uuid, entity_data jsonb, view_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  SELECT public.is_admin(user_id) INTO is_admin_user;

  RETURN QUERY
  SELECT * FROM (
    -- Purchase Orders
    SELECT
      po.id,
      'purchase_order'::text,
      ('PO: ' || po.po_number)::text,
      COALESCE(s.supplier_name || ' - ' || po.description, po.description)::text,
      (CASE WHEN po.total_amount > 100000 THEN 'urgent'
            WHEN po.total_amount > 50000  THEN 'high'
            WHEN po.total_amount > 10000  THEN 'medium'
            ELSE 'low' END)::text,
      po.status::text,
      po.buyer_id,
      COALESCE(p.full_name,'Unknown')::text,
      po.status::text,
      1,
      po.created_at,
      po.total_amount,
      po.currency::text,
      po.id,
      jsonb_build_object('po_number', po.po_number, 'supplier_name', s.supplier_name, 'total_amount', po.total_amount, 'currency', po.currency),
      ('/procurement/purchase-order?id=' || po.id::text)::text
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN profiles  p ON p.user_id = po.buyer_id
    WHERE po.status IN ('pending_approval','pending_dept_head_approval')
      AND (is_admin_user OR po.created_by = user_id OR po.buyer_id = user_id)

    UNION ALL
    -- Purchase Requisitions
    SELECT pr.id, 'purchase_requisition'::text, ('PR: ' || pr.pr_number)::text, pr.description::text,
      (CASE WHEN pr.total_estimated_amount > 100000 THEN 'urgent'
            WHEN pr.total_estimated_amount > 50000 THEN 'high'
            WHEN pr.total_estimated_amount > 10000 THEN 'medium'
            ELSE 'low' END)::text,
      pr.status::text, pr.requested_by, COALESCE(p.full_name,'Unknown')::text,
      pr.status::text, 1, pr.created_at, pr.total_estimated_amount, 'USD'::text, pr.id,
      jsonb_build_object('pr_number', pr.pr_number, 'total_estimated_amount', pr.total_estimated_amount),
      ('/procurement/purchase-requisition?id=' || pr.id::text)::text
    FROM purchase_requisitions pr
    LEFT JOIN profiles p ON p.user_id = pr.requested_by
    WHERE pr.status IN ('submitted','pending_approval')
      AND (is_admin_user OR pr.requested_by = user_id)

    UNION ALL
    -- Customer Purchase Orders
    SELECT cpo.id, 'customer_po'::text, ('CPO: ' || cpo.po_number)::text,
      COALESCE(c.customer_name || ' - ' || cpo.description, cpo.description)::text,
      (CASE WHEN cpo.total_amount > 100000 THEN 'urgent'
            WHEN cpo.total_amount > 50000 THEN 'high'
            WHEN cpo.total_amount > 10000 THEN 'medium'
            ELSE 'low' END)::text,
      'pending'::text, cpo.created_by, COALESCE(p.full_name,'Unknown')::text,
      'pending_approval'::text, 1, cpo.created_at, cpo.total_amount, cpo.currency::text, cpo.id,
      jsonb_build_object('po_number', cpo.po_number, 'customer_name', c.customer_name, 'total_amount', cpo.total_amount),
      ('/tuh-modules/customer-po?id=' || cpo.id::text)::text
    FROM customer_purchase_orders cpo
    LEFT JOIN customers c ON c.id = cpo.customer_id
    LEFT JOIN profiles  p ON p.user_id = cpo.created_by
    WHERE cpo.pending_approval = true
      AND (is_admin_user OR cpo.created_by = user_id)

    UNION ALL
    -- Finished Goods Production Receipts
    SELECT fgb.id, 'production_receipt'::text, ('Batch: ' || fgb.batch_number)::text,
      COALESCE(fg.item_name,'Production Receipt')::text,
      (CASE WHEN fgb.quantity > 1000 THEN 'high' WHEN fgb.quantity > 500 THEN 'medium' ELSE 'low' END)::text,
      fgb.approval_status::text, fgb.created_by, COALESCE(p.full_name,'Unknown')::text,
      fgb.approval_status::text, 1, fgb.created_at, NULL::numeric, NULL::text, fgb.id,
      jsonb_build_object('batch_number', fgb.batch_number, 'quantity', fgb.quantity, 'item_name', fg.item_name),
      ('/tuh-modules/finished-goods?batch=' || fgb.id::text)::text
    FROM finished_goods_batches fgb
    LEFT JOIN finished_goods fg ON fg.id = fgb.finished_good_id
    LEFT JOIN profiles       p  ON p.user_id = fgb.created_by
    WHERE fgb.approval_status = 'pending'
      AND (is_admin_user OR fgb.created_by = user_id)

    UNION ALL
    -- Supplier Registrations
    SELECT saw.id, 'supplier_registration'::text,
      ('Supplier: ' || COALESCE((srr.supplier_data->>'company_name')::text,'New Supplier'))::text,
      COALESCE((srr.supplier_data->>'business_nature')::text,'Supplier registration')::text,
      'high'::text, saw.status::text, saw.assigned_to, COALESCE(p.full_name,'Unknown')::text,
      saw.stage::text,
      (CASE saw.stage WHEN 'initial_review' THEN 1 WHEN 'compliance_check' THEN 2 WHEN 'management_approval' THEN 3 ELSE 1 END),
      saw.created_at, NULL::numeric, NULL::text, saw.registration_request_id,
      jsonb_build_object('company_name', srr.supplier_data->>'company_name', 'stage', saw.stage),
      ('/sourcing/supplier-registration?request=' || saw.registration_request_id::text)::text
    FROM supplier_approval_workflow saw
    LEFT JOIN supplier_registration_requests srr ON srr.id = saw.registration_request_id
    LEFT JOIN profiles p ON p.user_id = saw.assigned_to
    WHERE saw.status = 'pending'
      AND (is_admin_user OR saw.assigned_to = user_id)

    UNION ALL
    -- Material Requests
    SELECT mr.id, 'material_request'::text, ('Material Request: ' || mr.request_number)::text,
      COALESCE(mr.purpose,'Material request')::text,
      (CASE mr.priority WHEN 'urgent' THEN 'urgent' WHEN 'high' THEN 'high' WHEN 'medium' THEN 'medium' ELSE 'low' END)::text,
      mr.status::text, mr.created_by, COALESCE(p.full_name,'Unknown')::text,
      mr.status::text, 1, mr.created_at, NULL::numeric, NULL::text, mr.id,
      jsonb_build_object('request_number', mr.request_number, 'priority', mr.priority),
      ('/warehouse/material-issue-return?request=' || mr.id::text)::text
    FROM material_requests mr
    LEFT JOIN profiles p ON p.user_id = mr.created_by
    WHERE mr.status IN ('pending_hod_approval','pending_management_approval')
      AND (is_admin_user OR mr.created_by = user_id)

    UNION ALL
    -- Goods Receipt Notes
    SELECT grn.id, 'grn'::text, ('GRN: ' || grn.grn_number)::text,
      COALESCE(po.po_number || ' - ' || s.supplier_name,'Goods receipt')::text,
      (CASE WHEN po.total_amount > 100000 THEN 'high' WHEN po.total_amount > 50000 THEN 'medium' ELSE 'low' END)::text,
      grn.status::text, grn.created_by, COALESCE(p.full_name,'Unknown')::text,
      grn.status::text, 1, grn.created_at, NULL::numeric, NULL::text, grn.id,
      jsonb_build_object('grn_number', grn.grn_number, 'po_number', po.po_number, 'supplier_name', s.supplier_name),
      ('/warehouse/goods-receipt-note?id=' || grn.id::text)::text
    FROM goods_receipt_notes grn
    LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
    LEFT JOIN suppliers      s  ON s.id = po.supplier_id
    LEFT JOIN profiles       p  ON p.user_id = grn.created_by
    WHERE grn.status = 'submitted'
      AND (is_admin_user OR grn.created_by = user_id)

    UNION ALL
    -- Material Issue Notes (pending admin approval)  ← NEW
    SELECT min_n.id, 'material_issue'::text, ('MIN: ' || min_n.min_number)::text,
      COALESCE(min_n.purpose, min_n.issued_to, 'Material issue')::text,
      'high'::text,
      min_n.status::text, min_n.created_by, COALESCE(p.full_name,'Unknown')::text,
      min_n.status::text, 1, min_n.created_at, min_n.total_value, NULL::text, min_n.id,
      jsonb_build_object('min_number', min_n.min_number, 'issued_to', min_n.issued_to, 'department', min_n.department, 'requested_by', min_n.requested_by),
      ('/warehouse/material-issue-return?min=' || min_n.id::text)::text
    FROM material_issue_notes min_n
    LEFT JOIN profiles p ON p.user_id = min_n.created_by
    WHERE min_n.status = 'pending_approval'
      AND (is_admin_user OR min_n.created_by = user_id)
  ) approvals
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_approval_console(uuid, integer) TO authenticated;
