-- =====================================================================
-- Reports Center Phase 3 — Cross-module reporting RPCs
-- =====================================================================

CREATE OR REPLACE FUNCTION public.report_trial_balance(
  p_company_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  account_code text, account_name text, account_type text, account_category text,
  opening_balance numeric, period_debit numeric, period_credit numeric, closing_balance numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH posted AS (
    SELECT jel.account_id,
           COALESCE(SUM(jel.debit_amount), 0) AS dr,
           COALESCE(SUM(jel.credit_amount), 0) AS cr
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND je.status::text = 'posted'
      AND je.journal_date <= p_as_of_date
    GROUP BY jel.account_id
  )
  SELECT
    coa.account_code, coa.account_name,
    coa.account_type::text, coa.account_category::text,
    COALESCE(coa.opening_balance, 0),
    COALESCE(p.dr, 0), COALESCE(p.cr, 0),
    COALESCE(coa.opening_balance, 0) +
      CASE WHEN coa.normal_balance::text = 'debit'
           THEN COALESCE(p.dr, 0) - COALESCE(p.cr, 0)
           ELSE COALESCE(p.cr, 0) - COALESCE(p.dr, 0)
      END
  FROM chart_of_accounts coa
  LEFT JOIN posted p ON p.account_id = coa.id
  WHERE coa.company_id = p_company_id
    AND coa.is_active = true
    AND coa.is_header = false
  ORDER BY coa.account_code
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_general_ledger_detail(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE (
  journal_date date, journal_number text, journal_type text,
  account_code text, account_name text, description text, reference_number text,
  debit_amount numeric, credit_amount numeric, cost_center text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    je.journal_date, je.journal_number, je.journal_type::text,
    coa.account_code, coa.account_name,
    COALESCE(jel.description, je.description), je.reference_number,
    COALESCE(jel.debit_amount, 0), COALESCE(jel.credit_amount, 0),
    cc.name
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  JOIN chart_of_accounts coa ON coa.id = jel.account_id
  LEFT JOIN cost_centers cc ON cc.id = jel.cost_center_id
  WHERE je.company_id = p_company_id
    AND je.status::text = 'posted'
    AND (p_date_from IS NULL OR je.journal_date >= p_date_from)
    AND (p_date_to IS NULL OR je.journal_date <= p_date_to)
    AND (p_account_id IS NULL OR jel.account_id = p_account_id)
  ORDER BY je.journal_date, je.journal_number, jel.line_number
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_ap_aging(
  p_company_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS TABLE (
  invoice_number text, supplier_name text, invoice_date date, due_date date,
  net_amount numeric, amount_paid numeric, outstanding numeric, days_overdue integer,
  bucket text, bucket_0_30 numeric, bucket_31_60 numeric, bucket_61_90 numeric,
  bucket_90_plus numeric, currency text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH base AS (
    SELECT
      si.invoice_number, s.name AS supplier_name, si.invoice_date, si.due_date,
      COALESCE(si.net_amount, 0) AS net_amount,
      COALESCE(si.amount_paid, 0) AS amount_paid,
      COALESCE(si.net_amount, 0) - COALESCE(si.amount_paid, 0) AS outstanding,
      GREATEST(0, (p_as_of_date - COALESCE(si.due_date, si.invoice_date))::int) AS days_overdue,
      si.currency
    FROM supplier_invoices si
    LEFT JOIN suppliers s ON s.id = si.supplier_id
    WHERE si.company_id = p_company_id
      AND COALESCE(si.status, '') NOT IN ('cancelled', 'void')
      AND COALESCE(si.net_amount, 0) - COALESCE(si.amount_paid, 0) > 0.01
      AND (p_supplier_id IS NULL OR si.supplier_id = p_supplier_id)
      AND si.invoice_date <= p_as_of_date
  )
  SELECT
    invoice_number, supplier_name, invoice_date, due_date,
    net_amount, amount_paid, outstanding, days_overdue,
    CASE
      WHEN days_overdue = 0 THEN 'Current'
      WHEN days_overdue <= 30 THEN '0-30'
      WHEN days_overdue <= 60 THEN '31-60'
      WHEN days_overdue <= 90 THEN '61-90'
      ELSE '90+'
    END,
    CASE WHEN days_overdue <= 30 THEN outstanding ELSE 0 END,
    CASE WHEN days_overdue BETWEEN 31 AND 60 THEN outstanding ELSE 0 END,
    CASE WHEN days_overdue BETWEEN 61 AND 90 THEN outstanding ELSE 0 END,
    CASE WHEN days_overdue > 90 THEN outstanding ELSE 0 END,
    currency
  FROM base
  ORDER BY days_overdue DESC, supplier_name
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_ar_aging(
  p_company_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE,
  p_customer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  invoice_number text, customer_name text, invoice_date date, due_date date,
  net_amount numeric, amount_received numeric, outstanding numeric, days_overdue integer,
  bucket text, bucket_0_30 numeric, bucket_31_60 numeric, bucket_61_90 numeric,
  bucket_90_plus numeric, currency text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH base AS (
    SELECT
      ci.invoice_number, c.customer_name, ci.invoice_date, ci.due_date,
      COALESCE(ci.net_amount, 0) AS net_amount,
      COALESCE(ci.amount_received, 0) AS amount_received,
      COALESCE(ci.net_amount, 0) - COALESCE(ci.amount_received, 0) AS outstanding,
      GREATEST(0, (p_as_of_date - COALESCE(ci.due_date, ci.invoice_date))::int) AS days_overdue,
      ci.currency
    FROM customer_invoices ci
    LEFT JOIN customers c ON c.id = ci.customer_id
    WHERE ci.company_id = p_company_id
      AND COALESCE(ci.status, '') NOT IN ('cancelled', 'void')
      AND COALESCE(ci.net_amount, 0) - COALESCE(ci.amount_received, 0) > 0.01
      AND (p_customer_id IS NULL OR ci.customer_id = p_customer_id)
      AND ci.invoice_date <= p_as_of_date
  )
  SELECT
    invoice_number, customer_name, invoice_date, due_date,
    net_amount, amount_received, outstanding, days_overdue,
    CASE
      WHEN days_overdue = 0 THEN 'Current'
      WHEN days_overdue <= 30 THEN '0-30'
      WHEN days_overdue <= 60 THEN '31-60'
      WHEN days_overdue <= 90 THEN '61-90'
      ELSE '90+'
    END,
    CASE WHEN days_overdue <= 30 THEN outstanding ELSE 0 END,
    CASE WHEN days_overdue BETWEEN 31 AND 60 THEN outstanding ELSE 0 END,
    CASE WHEN days_overdue BETWEEN 61 AND 90 THEN outstanding ELSE 0 END,
    CASE WHEN days_overdue > 90 THEN outstanding ELSE 0 END,
    currency
  FROM base
  ORDER BY days_overdue DESC, customer_name
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_fixed_asset_register(
  p_company_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  asset_id text, name text, category text, serial_number text, asset_tag text,
  purchase_date date, purchase_price numeric,
  depreciation_method text, depreciation_rate numeric, useful_life_years integer,
  salvage_value numeric, accumulated_depreciation numeric, net_book_value numeric,
  status text, location_name text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    wa.asset_id, wa.name, wa.category, wa.serial_number, wa.asset_tag,
    wa.purchase_date, COALESCE(wa.purchase_price, 0),
    wa.depreciation_method, COALESCE(wa.depreciation_rate, 0), wa.useful_life_years,
    COALESCE(wa.salvage_value, 0), COALESCE(wa.accumulated_depreciation, 0),
    GREATEST(
      COALESCE(wa.salvage_value, 0),
      COALESCE(wa.purchase_price, 0) - COALESCE(wa.accumulated_depreciation, 0)
    ),
    wa.status, wl.name
  FROM warehouse_assets wa
  LEFT JOIN warehouse_locations wl ON wl.id = wa.location_id
  WHERE wa.company_id = p_company_id
    AND (wa.purchase_date IS NULL OR wa.purchase_date <= p_as_of_date)
  ORDER BY wa.asset_id
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_cash_bank_statement(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_bank_account_id uuid DEFAULT NULL
)
RETURNS TABLE (
  transaction_date date, bank_name text, account_name text, transaction_type text,
  reference_number text, description text, debit_amount numeric, credit_amount numeric,
  running_balance numeric, is_reconciled boolean, currency text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    bt.transaction_date, ba.bank_name, ba.account_name, bt.transaction_type,
    bt.reference_number, bt.description,
    COALESCE(bt.debit_amount, 0), COALESCE(bt.credit_amount, 0),
    bt.running_balance, bt.is_reconciled, ba.currency
  FROM bank_transactions bt
  JOIN bank_accounts ba ON ba.id = bt.bank_account_id
  WHERE bt.company_id = p_company_id
    AND (p_date_from IS NULL OR bt.transaction_date >= p_date_from)
    AND (p_date_to IS NULL OR bt.transaction_date <= p_date_to)
    AND (p_bank_account_id IS NULL OR bt.bank_account_id = p_bank_account_id)
  ORDER BY bt.transaction_date DESC, bt.created_at DESC
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_pr_register(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  pr_number text, title text, requested_date date, required_date date,
  department text, priority text, status text,
  total_estimated_amount numeric, line_count bigint, approved_date timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    pr.pr_number, pr.title, pr.requested_date, pr.required_date,
    pr.department, pr.priority::text, pr.status::text,
    COALESCE(pr.total_estimated_amount, 0),
    (SELECT COUNT(*) FROM pr_items pi WHERE pi.pr_id = pr.id),
    pr.approved_date
  FROM purchase_requisitions pr
  WHERE pr.company_id = p_company_id
    AND (p_date_from IS NULL OR pr.requested_date >= p_date_from)
    AND (p_date_to IS NULL OR pr.requested_date <= p_date_to)
    AND (p_status IS NULL OR pr.status::text = p_status)
  ORDER BY pr.requested_date DESC
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_po_register(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  po_number text, po_date date, supplier_name text, status text,
  expected_delivery_date date, actual_delivery_date date,
  final_amount numeric, currency text, line_count bigint, approved_date timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    po.po_number, po.po_date, s.name, po.status::text,
    po.expected_delivery_date, po.actual_delivery_date,
    COALESCE(po.final_amount, po.total_amount, 0), po.currency,
    (SELECT COUNT(*) FROM po_items pi WHERE pi.po_id = po.id),
    po.approved_date
  FROM purchase_orders po
  LEFT JOIN suppliers s ON s.id = po.supplier_id
  WHERE po.company_id = p_company_id
    AND (p_date_from IS NULL OR po.po_date >= p_date_from)
    AND (p_date_to IS NULL OR po.po_date <= p_date_to)
    AND (p_status IS NULL OR po.status::text = p_status)
  ORDER BY po.po_date DESC
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_open_po(
  p_company_id uuid
)
RETURNS TABLE (
  po_number text, po_date date, supplier_name text, status text,
  expected_delivery_date date,
  total_qty_ordered numeric, total_qty_received numeric, total_qty_pending numeric,
  outstanding_value numeric, currency text, days_open integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH agg AS (
    SELECT pi.po_id,
           SUM(COALESCE(pi.quantity_ordered, 0)) AS qo,
           SUM(COALESCE(pi.quantity_received, 0)) AS qr,
           SUM(COALESCE(pi.quantity_pending, 0)) AS qp,
           SUM(COALESCE(pi.quantity_pending, 0) * COALESCE(pi.unit_price, 0)) AS outstanding_val
    FROM po_items pi
    GROUP BY pi.po_id
  )
  SELECT
    po.po_number, po.po_date, s.name, po.status::text,
    po.expected_delivery_date,
    COALESCE(a.qo, 0), COALESCE(a.qr, 0), COALESCE(a.qp, 0),
    COALESCE(a.outstanding_val, 0), po.currency,
    GREATEST(0, (CURRENT_DATE - po.po_date)::int)
  FROM purchase_orders po
  LEFT JOIN suppliers s ON s.id = po.supplier_id
  LEFT JOIN agg a ON a.po_id = po.id
  WHERE po.company_id = p_company_id
    AND po.status::text NOT IN ('cancelled', 'closed', 'completed')
    AND COALESCE(a.qp, 0) > 0
  ORDER BY po.po_date
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_three_way_match_exceptions(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  invoice_number text, invoice_date date, supplier_name text, po_number text,
  grn_number text, three_way_match_status text, invoice_amount numeric,
  status text, currency text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    si.invoice_number, si.invoice_date, s.name, po.po_number, grn.grn_number,
    si.three_way_match_status, COALESCE(si.net_amount, 0), si.status, si.currency
  FROM supplier_invoices si
  LEFT JOIN suppliers s ON s.id = si.supplier_id
  LEFT JOIN purchase_orders po ON po.id = si.po_id
  LEFT JOIN goods_receipt_notes grn ON grn.id = si.grn_id
  WHERE si.company_id = p_company_id
    AND (si.three_way_match_status IS NULL
         OR si.three_way_match_status NOT IN ('matched', 'auto_matched'))
    AND (p_date_from IS NULL OR si.invoice_date >= p_date_from)
    AND (p_date_to IS NULL OR si.invoice_date <= p_date_to)
  ORDER BY si.invoice_date DESC
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_spend_analysis(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  period_month text, supplier_name text, po_count bigint,
  total_qty numeric, total_spend numeric, currency text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    to_char(po.po_date, 'YYYY-MM'),
    s.name,
    COUNT(DISTINCT po.id),
    COALESCE(SUM(pi.quantity_ordered), 0),
    COALESCE(SUM(COALESCE(pi.quantity_ordered, 0) * COALESCE(pi.unit_price, 0)), 0),
    MAX(po.currency)
  FROM purchase_orders po
  JOIN po_items pi ON pi.po_id = po.id
  LEFT JOIN suppliers s ON s.id = po.supplier_id
  WHERE po.company_id = p_company_id
    AND po.status::text NOT IN ('cancelled', 'rejected', 'draft')
    AND (p_date_from IS NULL OR po.po_date >= p_date_from)
    AND (p_date_to IS NULL OR po.po_date <= p_date_to)
  GROUP BY to_char(po.po_date, 'YYYY-MM'), s.name
  ORDER BY 1 DESC, 5 DESC
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_rfq_register(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  request_number text, request_type text, title text, category text,
  status text, priority text, issue_date date,
  submission_deadline date, evaluation_deadline date,
  budget_estimate numeric, currency text,
  invited_count bigint, quote_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    r.request_number, r.request_type::text, r.title, r.category,
    r.status::text, r.priority::text, r.issue_date,
    r.submission_deadline, r.evaluation_deadline,
    COALESCE(r.budget_estimate, 0), r.currency,
    (SELECT COUNT(*) FROM rfq_rfp_invited_suppliers i WHERE i.request_id = r.id),
    (SELECT COUNT(*) FROM supplier_quotes q WHERE q.request_id = r.id)
  FROM rfq_rfp_requests r
  WHERE r.company_id = p_company_id
    AND (p_date_from IS NULL OR r.issue_date >= p_date_from)
    AND (p_date_to IS NULL OR r.issue_date <= p_date_to)
    AND (p_status IS NULL OR r.status::text = p_status)
  ORDER BY r.issue_date DESC NULLS LAST
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_quote_comparison(
  p_company_id uuid,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  request_number text, request_title text, supplier_name text, quote_number text,
  submission_date timestamptz, status text,
  total_quoted_amount numeric, currency text,
  validity_period integer, payment_terms text, delivery_commitment text,
  evaluation_score numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    r.request_number, r.title, s.name, q.quote_number,
    q.submission_date, q.status::text,
    COALESCE(q.total_quoted_amount, 0), q.currency,
    q.validity_period, q.payment_terms, q.delivery_commitment,
    q.evaluation_score
  FROM supplier_quotes q
  JOIN rfq_rfp_requests r ON r.id = q.request_id
  LEFT JOIN suppliers s ON s.id = q.supplier_id
  WHERE r.company_id = p_company_id
    AND (p_request_id IS NULL OR q.request_id = p_request_id)
  ORDER BY r.request_number, COALESCE(q.evaluation_score, 0) DESC, q.total_quoted_amount
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_supplier_scorecard(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  supplier_code text, supplier_name text, category text, rating numeric,
  total_pos bigint, total_spend numeric, on_time_delivery_pct numeric,
  avg_evaluation_score numeric, open_action_items bigint, status text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH po_stats AS (
    SELECT po.supplier_id,
           COUNT(*) AS total_pos,
           SUM(COALESCE(po.final_amount, po.total_amount, 0)) AS total_spend,
           AVG(
             CASE
               WHEN po.actual_delivery_date IS NULL OR po.expected_delivery_date IS NULL THEN NULL
               WHEN po.actual_delivery_date <= po.expected_delivery_date THEN 100
               ELSE 0
             END
           ) AS otd_pct
    FROM purchase_orders po
    WHERE po.company_id = p_company_id
      AND (p_date_from IS NULL OR po.po_date >= p_date_from)
      AND (p_date_to IS NULL OR po.po_date <= p_date_to)
    GROUP BY po.supplier_id
  ),
  eval_stats AS (
    SELECT supplier_id, AVG(performance_rate) AS avg_score
    FROM supplier_evaluations
    WHERE company_id = p_company_id
    GROUP BY supplier_id
  )
  SELECT
    s.supplier_code, s.name, s.category, s.rating,
    COALESCE(p.total_pos, 0),
    COALESCE(p.total_spend, 0),
    COALESCE(p.otd_pct, 0),
    COALESCE(e.avg_score, 0),
    (SELECT COUNT(*) FROM supplier_action_items sai
       WHERE sai.supplier_id = s.id AND sai.status NOT IN ('closed', 'resolved', 'completed')),
    s.status
  FROM suppliers s
  LEFT JOIN po_stats p ON p.supplier_id = s.id
  LEFT JOIN eval_stats e ON e.supplier_id = s.id
  WHERE s.company_id = p_company_id
  ORDER BY total_spend DESC NULLS LAST
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_contract_expiry(
  p_company_id uuid,
  p_horizon_days integer DEFAULT 180
)
RETURNS TABLE (
  contract_number text, contract_title text, contract_type text, status text,
  counterparty_name text, contract_value numeric, currency text,
  effective_date date, expiry_date date, days_to_expiry integer,
  auto_renew boolean, renewal_count integer, owner_id uuid
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    c.contract_number, c.contract_title, c.contract_type::text, c.status::text,
    c.counterparty_name, COALESCE(c.contract_value, 0), c.currency,
    c.effective_date, c.expiry_date,
    (c.expiry_date - CURRENT_DATE)::int,
    c.auto_renew, c.renewal_count, c.owner_id
  FROM contracts c
  WHERE c.company_id = p_company_id
    AND c.expiry_date IS NOT NULL
    AND c.expiry_date <= CURRENT_DATE + p_horizon_days
    AND c.status::text NOT IN ('terminated', 'cancelled', 'expired')
  ORDER BY c.expiry_date
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_production_wip(
  p_company_id uuid
)
RETURNS TABLE (
  order_number text, product_name text, style_no text, target_qty numeric,
  stage_name text, sequence_order integer, stage_status text,
  input_qty numeric, output_qty numeric, wastage_qty numeric, wip_qty numeric,
  stage_cost numeric, started_at timestamptz, completed_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    po.order_number, po.product_name, po.style_no, po.target_qty,
    pos.stage_name, pos.sequence_order, pos.status,
    COALESCE(pos.input_qty, 0), COALESCE(pos.output_qty, 0), COALESCE(pos.wastage_qty, 0),
    GREATEST(0, COALESCE(pos.input_qty, 0) - COALESCE(pos.output_qty, 0) - COALESCE(pos.wastage_qty, 0)),
    COALESCE((SELECT SUM(total_cost) FROM production_stage_costs psc WHERE psc.stage_id = pos.id), 0),
    pos.started_at, pos.completed_at
  FROM production_order_stages pos
  JOIN production_orders po ON po.id = pos.order_id
  WHERE po.company_id = p_company_id
    AND po.status NOT IN ('completed', 'cancelled')
  ORDER BY po.order_number, pos.sequence_order
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_production_daily_output(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  entry_date date, order_number text, product_name text, stage_name text,
  input_qty numeric, output_qty numeric, wastage_qty numeric,
  efficiency_pct numeric, notes text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    pde.entry_date, po.order_number, po.product_name, pos.stage_name,
    COALESCE(pde.input_qty, 0), COALESCE(pde.output_qty, 0), COALESCE(pde.wastage_qty, 0),
    CASE WHEN COALESCE(pde.input_qty, 0) > 0
         THEN ROUND(100.0 * COALESCE(pde.output_qty, 0) / pde.input_qty, 2)
         ELSE 0 END,
    pde.notes
  FROM production_daily_entries pde
  JOIN production_order_stages pos ON pos.id = pde.stage_id
  JOIN production_orders po ON po.id = pos.order_id
  WHERE po.company_id = p_company_id
    AND (p_date_from IS NULL OR pde.entry_date >= p_date_from)
    AND (p_date_to IS NULL OR pde.entry_date <= p_date_to)
  ORDER BY pde.entry_date DESC, po.order_number, pos.sequence_order
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_production_stage_cost(
  p_company_id uuid,
  p_order_id uuid DEFAULT NULL
)
RETURNS TABLE (
  order_number text, product_name text, stage_name text, sequence_order integer,
  item_name text, source text, unit_of_measure text,
  quantity_used numeric, unit_cost numeric, total_cost numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    po.order_number, po.product_name, pos.stage_name, pos.sequence_order,
    psc.item_name, psc.source, psc.unit_of_measure,
    COALESCE(psc.quantity_used, 0), COALESCE(psc.unit_cost, 0), COALESCE(psc.total_cost, 0)
  FROM production_stage_costs psc
  JOIN production_order_stages pos ON pos.id = psc.stage_id
  JOIN production_orders po ON po.id = pos.order_id
  WHERE po.company_id = p_company_id
    AND (p_order_id IS NULL OR po.id = p_order_id)
  ORDER BY po.order_number, pos.sequence_order
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_production_efficiency(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  order_number text, product_name text, target_qty numeric,
  total_input numeric, total_output numeric, total_wastage numeric,
  yield_pct numeric, wastage_pct numeric, completion_pct numeric,
  status text, start_date date, due_date date
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH stage_totals AS (
    SELECT pos.order_id,
           SUM(COALESCE(pos.input_qty, 0)) AS total_input,
           SUM(COALESCE(pos.output_qty, 0)) AS total_output,
           SUM(COALESCE(pos.wastage_qty, 0)) AS total_wastage
    FROM production_order_stages pos
    GROUP BY pos.order_id
  )
  SELECT
    po.order_number, po.product_name, po.target_qty,
    COALESCE(st.total_input, 0), COALESCE(st.total_output, 0), COALESCE(st.total_wastage, 0),
    CASE WHEN COALESCE(st.total_input, 0) > 0
         THEN ROUND(100.0 * st.total_output / st.total_input, 2) ELSE 0 END,
    CASE WHEN COALESCE(st.total_input, 0) > 0
         THEN ROUND(100.0 * st.total_wastage / st.total_input, 2) ELSE 0 END,
    CASE WHEN COALESCE(po.target_qty, 0) > 0
         THEN ROUND(100.0 * COALESCE(st.total_output, 0) / po.target_qty, 2) ELSE 0 END,
    po.status, po.start_date, po.due_date
  FROM production_orders po
  LEFT JOIN stage_totals st ON st.order_id = po.id
  WHERE po.company_id = p_company_id
    AND (p_date_from IS NULL OR po.start_date >= p_date_from)
    AND (p_date_to IS NULL OR po.start_date <= p_date_to)
  ORDER BY po.start_date DESC NULLS LAST
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_construction_dsr_summary(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  report_number text, report_date date, project_code text, project_name text,
  weather_conditions text, temperature_high numeric, temperature_low numeric,
  labor_count integer, skilled_labor_count integer, unskilled_labor_count integer,
  subcontractor_count integer, visitor_count integer,
  attendance_present bigint, attendance_absent bigint, status text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    dsr.report_number, dsr.report_date, cp.project_code, cp.project_name,
    dsr.weather_conditions, dsr.temperature_high, dsr.temperature_low,
    dsr.labor_count, dsr.skilled_labor_count, dsr.unskilled_labor_count,
    dsr.subcontractor_count, dsr.visitor_count,
    (SELECT COUNT(*) FROM site_report_labour_attendance a
        WHERE a.site_report_id = dsr.id AND a.attendance_status = 'present'),
    (SELECT COUNT(*) FROM site_report_labour_attendance a
        WHERE a.site_report_id = dsr.id AND a.attendance_status = 'absent'),
    dsr.status
  FROM daily_site_reports dsr
  JOIN construction_projects cp ON cp.id = dsr.project_id
  WHERE dsr.company_id = p_company_id
    AND (p_date_from IS NULL OR dsr.report_date >= p_date_from)
    AND (p_date_to IS NULL OR dsr.report_date <= p_date_to)
    AND (p_project_id IS NULL OR dsr.project_id = p_project_id)
  ORDER BY dsr.report_date DESC
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_construction_progress(
  p_company_id uuid
)
RETURNS TABLE (
  project_code text, project_name text, status text,
  start_date date, target_end_date date, actual_end_date date,
  estimated_budget numeric, actual_cost numeric, completion_percentage numeric,
  days_elapsed integer, days_total integer, schedule_variance_pct numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    cp.project_code, cp.project_name, cp.status,
    cp.start_date, cp.target_end_date, cp.actual_end_date,
    COALESCE(cp.estimated_budget, 0), COALESCE(cp.actual_cost, 0),
    COALESCE(cp.completion_percentage, 0),
    GREATEST(0, (CURRENT_DATE - cp.start_date)::int),
    CASE WHEN cp.start_date IS NOT NULL AND cp.target_end_date IS NOT NULL
         THEN (cp.target_end_date - cp.start_date)::int ELSE 0 END,
    CASE
      WHEN cp.start_date IS NULL OR cp.target_end_date IS NULL
        OR (cp.target_end_date - cp.start_date)::int = 0 THEN 0
      ELSE ROUND(
        COALESCE(cp.completion_percentage, 0) -
        (100.0 * GREATEST(0, (CURRENT_DATE - cp.start_date)::int) /
         (cp.target_end_date - cp.start_date)::int),
        2)
    END
  FROM construction_projects cp
  WHERE cp.company_id = p_company_id
  ORDER BY cp.start_date DESC NULLS LAST
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_construction_budget_variance(
  p_company_id uuid,
  p_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  project_code text, project_name text, budget_code text, category text,
  description text, unit text, quantity numeric, unit_cost numeric,
  planned_amount numeric, committed_amount numeric, actual_amount numeric,
  variance_amount numeric, variance_pct numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    cp.project_code, cp.project_name,
    pbi.budget_code, pbi.category, pbi.description, pbi.unit,
    COALESCE(pbi.quantity, 0), COALESCE(pbi.unit_cost, 0),
    COALESCE(pbi.planned_amount, 0), COALESCE(pbi.committed_amount, 0), COALESCE(pbi.actual_amount, 0),
    COALESCE(pbi.planned_amount, 0) - COALESCE(pbi.actual_amount, 0),
    CASE WHEN COALESCE(pbi.planned_amount, 0) <> 0
         THEN ROUND(100.0 * (COALESCE(pbi.planned_amount, 0) - COALESCE(pbi.actual_amount, 0))
                    / pbi.planned_amount, 2)
         ELSE 0 END
  FROM project_budget_items pbi
  JOIN construction_projects cp ON cp.id = pbi.project_id
  WHERE pbi.company_id = p_company_id
    AND (p_project_id IS NULL OR pbi.project_id = p_project_id)
  ORDER BY cp.project_code, pbi.budget_code
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_construction_material_movements(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  transaction_date date, transaction_type text, item_code text, item_name text,
  quantity_change numeric, location_name text, notes text, performed_by uuid
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    cit.transaction_date::date, cit.transaction_type,
    cim.item_code, cim.item_name,
    COALESCE(cit.quantity_change, 0), wl.name, cit.notes, cit.performed_by
  FROM construction_inventory_transactions cit
  LEFT JOIN construction_item_master cim ON cim.id = cit.item_master_id
  LEFT JOIN warehouse_locations wl ON wl.id = cit.location_id
  WHERE cit.company_id = p_company_id
    AND (p_date_from IS NULL OR cit.transaction_date::date >= p_date_from)
    AND (p_date_to IS NULL OR cit.transaction_date::date <= p_date_to)
  ORDER BY cit.transaction_date DESC
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_pending_approvals(
  p_company_id uuid
)
RETURNS TABLE (
  module text, document_type text, document_number text, title text,
  submitted_date timestamptz, days_pending integer,
  current_status text, amount numeric, currency text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT 'procurement'::text, 'PR'::text, pr.pr_number, pr.title,
         pr.created_at,
         GREATEST(0, (CURRENT_DATE - pr.created_at::date)::int),
         pr.status::text,
         COALESCE(pr.total_estimated_amount, 0),
         NULL::text
  FROM purchase_requisitions pr
  WHERE pr.company_id = p_company_id
    AND pr.status::text IN ('pending_approval', 'submitted', 'pending')

  UNION ALL

  SELECT 'procurement'::text, 'PO'::text, po.po_number,
         COALESCE(s.name, '—'),
         po.created_at,
         GREATEST(0, (CURRENT_DATE - po.created_at::date)::int),
         po.status::text,
         COALESCE(po.final_amount, po.total_amount, 0),
         po.currency
  FROM purchase_orders po
  LEFT JOIN suppliers s ON s.id = po.supplier_id
  WHERE po.company_id = p_company_id
    AND po.status::text IN ('pending_approval', 'submitted', 'pending')

  UNION ALL

  SELECT 'warehouse'::text, 'GRN'::text, grn.grn_number,
         NULL::text,
         grn.created_at,
         GREATEST(0, (CURRENT_DATE - grn.created_at::date)::int),
         grn.status,
         NULL::numeric,
         NULL::text
  FROM goods_receipt_notes grn
  WHERE grn.company_id = p_company_id
    AND grn.status IN ('pending_approval', 'submitted', 'pending')

  UNION ALL

  SELECT 'warehouse'::text, 'MIN'::text, m.min_number, m.purpose,
         m.created_at,
         GREATEST(0, (CURRENT_DATE - m.created_at::date)::int),
         m.status,
         COALESCE(m.total_value, 0),
         NULL::text
  FROM material_issue_notes m
  WHERE m.company_id = p_company_id
    AND m.status IN ('pending_approval', 'submitted', 'pending')

  ORDER BY 6 DESC
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_system_audit_log(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_module text DEFAULT NULL
)
RETURNS TABLE (
  event_time timestamptz, module text, event_type text,
  reference text, details text, user_id uuid
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    ral.generated_at, ral.module_key, 'report_export'::text,
    ral.report_code,
    (ral.report_title || ' (' || ral.format || ', ' || ral.row_count || ' rows)'),
    ral.generated_by
  FROM report_audit_log ral
  WHERE ral.company_id = p_company_id
    AND (p_date_from IS NULL OR ral.generated_at::date >= p_date_from)
    AND (p_date_to IS NULL OR ral.generated_at::date <= p_date_to)
    AND (p_module IS NULL OR ral.module_key = p_module)
  ORDER BY ral.generated_at DESC
  LIMIT 50000
$$;

CREATE OR REPLACE FUNCTION public.report_report_usage(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  generated_at timestamptz, report_code text, report_title text, module_key text,
  format text, row_count integer, generated_by uuid, user_agent text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    ral.generated_at, ral.report_code, ral.report_title, ral.module_key,
    ral.format, ral.row_count, ral.generated_by, ral.user_agent
  FROM report_audit_log ral
  WHERE ral.company_id = p_company_id
    AND (p_date_from IS NULL OR ral.generated_at::date >= p_date_from)
    AND (p_date_to IS NULL OR ral.generated_at::date <= p_date_to)
  ORDER BY ral.generated_at DESC
  LIMIT 50000
$$;
