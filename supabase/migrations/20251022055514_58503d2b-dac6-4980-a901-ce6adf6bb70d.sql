-- Create function to get all approval console data
-- This function uses SECURITY DEFINER to bypass RLS and implements role-based access control internally

CREATE OR REPLACE FUNCTION get_approval_console(user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  description text,
  priority_text text,
  status_text text,
  assigned_to uuid,
  assigned_to_name text,
  stage text,
  stage_order integer,
  created_at timestamptz,
  amount numeric,
  currency text,
  entity_id uuid,
  entity_data jsonb,
  view_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  -- Check if user is admin
  SELECT is_admin(user_id) INTO is_admin_user;
  
  RETURN QUERY
  -- Purchase Orders
  SELECT 
    po.id,
    'purchase_order'::text as type,
    ('PO: ' || po.po_number)::text as title,
    COALESCE(s.supplier_name || ' - ' || po.description, po.description)::text as description,
    CASE 
      WHEN po.total_amount > 100000 THEN 'urgent'
      WHEN po.total_amount > 50000 THEN 'high'
      WHEN po.total_amount > 10000 THEN 'medium'
      ELSE 'low'
    END::text as priority_text,
    po.status::text as status_text,
    po.buyer_id as assigned_to,
    COALESCE(p.full_name, 'Unknown')::text as assigned_to_name,
    po.status::text as stage,
    1 as stage_order,
    po.created_at,
    po.total_amount as amount,
    po.currency::text,
    po.id as entity_id,
    jsonb_build_object(
      'po_number', po.po_number,
      'supplier_name', s.supplier_name,
      'total_amount', po.total_amount,
      'currency', po.currency
    ) as entity_data,
    ('/procurement/purchase-order?id=' || po.id::text)::text as view_url
  FROM purchase_orders po
  LEFT JOIN suppliers s ON s.id = po.supplier_id
  LEFT JOIN profiles p ON p.user_id = po.buyer_id
  WHERE po.status IN ('pending_approval', 'pending_dept_head_approval')
    AND (is_admin_user OR po.created_by = user_id OR po.buyer_id = user_id)
  
  UNION ALL
  
  -- Purchase Requisitions
  SELECT 
    pr.id,
    'purchase_requisition'::text as type,
    ('PR: ' || pr.pr_number)::text as title,
    pr.description::text,
    CASE 
      WHEN pr.total_estimated_amount > 100000 THEN 'urgent'
      WHEN pr.total_estimated_amount > 50000 THEN 'high'
      WHEN pr.total_estimated_amount > 10000 THEN 'medium'
      ELSE 'low'
    END::text as priority_text,
    pr.status::text as status_text,
    pr.requested_by as assigned_to,
    COALESCE(p.full_name, 'Unknown')::text as assigned_to_name,
    pr.status::text as stage,
    1 as stage_order,
    pr.created_at,
    pr.total_estimated_amount as amount,
    'USD'::text as currency,
    pr.id as entity_id,
    jsonb_build_object(
      'pr_number', pr.pr_number,
      'total_estimated_amount', pr.total_estimated_amount
    ) as entity_data,
    ('/procurement/purchase-requisition?id=' || pr.id::text)::text as view_url
  FROM purchase_requisitions pr
  LEFT JOIN profiles p ON p.user_id = pr.requested_by
  WHERE pr.status IN ('submitted', 'pending_approval')
    AND (is_admin_user OR pr.requested_by = user_id)
  
  UNION ALL
  
  -- Customer Purchase Orders
  SELECT 
    cpo.id,
    'customer_po'::text as type,
    ('CPO: ' || cpo.po_number)::text as title,
    COALESCE(c.customer_name || ' - ' || cpo.description, cpo.description)::text as description,
    CASE 
      WHEN cpo.total_amount > 100000 THEN 'urgent'
      WHEN cpo.total_amount > 50000 THEN 'high'
      WHEN cpo.total_amount > 10000 THEN 'medium'
      ELSE 'low'
    END::text as priority_text,
    'pending'::text as status_text,
    cpo.created_by as assigned_to,
    COALESCE(p.full_name, 'Unknown')::text as assigned_to_name,
    'pending_approval'::text as stage,
    1 as stage_order,
    cpo.created_at,
    cpo.total_amount as amount,
    cpo.currency::text,
    cpo.id as entity_id,
    jsonb_build_object(
      'po_number', cpo.po_number,
      'customer_name', c.customer_name,
      'total_amount', cpo.total_amount
    ) as entity_data,
    ('/tuh-modules/customer-po?id=' || cpo.id::text)::text as view_url
  FROM customer_purchase_orders cpo
  LEFT JOIN customers c ON c.id = cpo.customer_id
  LEFT JOIN profiles p ON p.user_id = cpo.created_by
  WHERE cpo.pending_approval = true
    AND (is_admin_user OR cpo.created_by = user_id)
  
  UNION ALL
  
  -- Finished Goods Production Receipts
  SELECT 
    fgb.id,
    'production_receipt'::text as type,
    ('Batch: ' || fgb.batch_number)::text as title,
    COALESCE(fg.item_name, 'Production Receipt')::text as description,
    CASE 
      WHEN fgb.quantity > 1000 THEN 'high'
      WHEN fgb.quantity > 500 THEN 'medium'
      ELSE 'low'
    END::text as priority_text,
    fgb.approval_status::text as status_text,
    fgb.created_by as assigned_to,
    COALESCE(p.full_name, 'Unknown')::text as assigned_to_name,
    fgb.approval_status::text as stage,
    1 as stage_order,
    fgb.created_at,
    NULL::numeric as amount,
    NULL::text as currency,
    fgb.id as entity_id,
    jsonb_build_object(
      'batch_number', fgb.batch_number,
      'quantity', fgb.quantity,
      'item_name', fg.item_name
    ) as entity_data,
    ('/tuh-modules/finished-goods?batch=' || fgb.id::text)::text as view_url
  FROM finished_goods_batches fgb
  LEFT JOIN finished_goods fg ON fg.id = fgb.finished_good_id
  LEFT JOIN profiles p ON p.user_id = fgb.created_by
  WHERE fgb.approval_status = 'pending'
    AND (is_admin_user OR fgb.created_by = user_id)
  
  UNION ALL
  
  -- Supplier Registrations
  SELECT 
    saw.id,
    'supplier_registration'::text as type,
    ('Supplier: ' || COALESCE((srr.supplier_data->>'company_name')::text, 'New Supplier'))::text as title,
    COALESCE((srr.supplier_data->>'business_nature')::text, 'Supplier registration')::text as description,
    'high'::text as priority_text,
    saw.status::text as status_text,
    saw.assigned_to as assigned_to,
    COALESCE(p.full_name, 'Unknown')::text as assigned_to_name,
    saw.stage::text as stage,
    CASE saw.stage
      WHEN 'initial_review' THEN 1
      WHEN 'compliance_check' THEN 2
      WHEN 'management_approval' THEN 3
      ELSE 1
    END as stage_order,
    saw.created_at,
    NULL::numeric as amount,
    NULL::text as currency,
    saw.registration_request_id as entity_id,
    jsonb_build_object(
      'company_name', srr.supplier_data->>'company_name',
      'stage', saw.stage
    ) as entity_data,
    ('/sourcing/supplier-registration?request=' || saw.registration_request_id::text)::text as view_url
  FROM supplier_approval_workflow saw
  LEFT JOIN supplier_registration_requests srr ON srr.id = saw.registration_request_id
  LEFT JOIN profiles p ON p.user_id = saw.assigned_to
  WHERE saw.status = 'pending'
    AND (is_admin_user OR saw.assigned_to = user_id)
  
  UNION ALL
  
  -- Material Requests
  SELECT 
    mr.id,
    'material_request'::text as type,
    ('Material Request: ' || mr.request_number)::text as title,
    COALESCE(mr.purpose, 'Material request')::text as description,
    CASE mr.priority
      WHEN 'urgent' THEN 'urgent'
      WHEN 'high' THEN 'high'
      WHEN 'medium' THEN 'medium'
      ELSE 'low'
    END::text as priority_text,
    mr.status::text as status_text,
    mr.created_by as assigned_to,
    COALESCE(p.full_name, 'Unknown')::text as assigned_to_name,
    mr.status::text as stage,
    1 as stage_order,
    mr.created_at,
    NULL::numeric as amount,
    NULL::text as currency,
    mr.id as entity_id,
    jsonb_build_object(
      'request_number', mr.request_number,
      'priority', mr.priority
    ) as entity_data,
    ('/warehouse/material-issue-return?request=' || mr.id::text)::text as view_url
  FROM material_requests mr
  LEFT JOIN profiles p ON p.user_id = mr.created_by
  WHERE mr.status IN ('pending_hod_approval', 'pending_management_approval')
    AND (is_admin_user OR mr.created_by = user_id)
  
  UNION ALL
  
  -- Goods Receipt Notes
  SELECT 
    grn.id,
    'grn'::text as type,
    ('GRN: ' || grn.grn_number)::text as title,
    COALESCE(po.po_number || ' - ' || s.supplier_name, 'Goods receipt')::text as description,
    CASE 
      WHEN po.total_amount > 100000 THEN 'high'
      WHEN po.total_amount > 50000 THEN 'medium'
      ELSE 'low'
    END::text as priority_text,
    grn.status::text as status_text,
    grn.created_by as assigned_to,
    COALESCE(p.full_name, 'Unknown')::text as assigned_to_name,
    grn.status::text as stage,
    1 as stage_order,
    grn.created_at,
    NULL::numeric as amount,
    NULL::text as currency,
    grn.id as entity_id,
    jsonb_build_object(
      'grn_number', grn.grn_number,
      'po_number', po.po_number,
      'supplier_name', s.supplier_name
    ) as entity_data,
    ('/warehouse/goods-receipt-note?id=' || grn.id::text)::text as view_url
  FROM goods_receipt_notes grn
  LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
  LEFT JOIN suppliers s ON s.id = po.supplier_id
  LEFT JOIN profiles p ON p.user_id = grn.created_by
  WHERE grn.status = 'submitted'
    AND (is_admin_user OR grn.created_by = user_id);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_approval_console(uuid) TO authenticated;

COMMENT ON FUNCTION get_approval_console IS 'Aggregates all pending approvals for the approval console. Admins see all, regular users see only their assigned items.';