
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_material_flow jsonb;
  v_inbound_outbound jsonb;
  v_top_issued jsonb;
  v_top_returned jsonb;
  v_movement_mix jsonb;
  v_spend_trend jsonb;
BEGIN
  -- 1. Material Flow 14d
  WITH days AS (
    SELECT generate_series(
      (CURRENT_DATE - INTERVAL '13 days')::date,
      CURRENT_DATE,
      '1 day'
    )::date AS d
  ),
  issued AS (
    SELECT date_trunc('day', mi.created_at)::date AS d,
           COALESCE(SUM(mii.quantity_issued), 0) AS qty
    FROM material_issue_items mii
    JOIN material_issue_notes mi ON mi.id = mii.min_id
    WHERE (p_company_id IS NULL OR mi.company_id = p_company_id)
      AND mi.created_at >= (CURRENT_DATE - INTERVAL '13 days')
    GROUP BY 1
  ),
  returned AS (
    SELECT date_trunc('day', mr.created_at)::date AS d,
           COALESCE(SUM(mri.quantity_returned), 0) AS qty
    FROM material_return_items mri
    JOIN material_return_notes mr ON mr.id = mri.mrn_id
    WHERE (p_company_id IS NULL OR mr.company_id = p_company_id)
      AND mr.created_at >= (CURRENT_DATE - INTERVAL '13 days')
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'd', to_char(days.d, 'YYYY-MM-DD'),
    'issued', COALESCE(i.qty, 0),
    'returned', COALESCE(r.qty, 0)
  ) ORDER BY days.d)
  INTO v_material_flow
  FROM days
  LEFT JOIN issued i ON i.d = days.d
  LEFT JOIN returned r ON r.d = days.d;

  -- 2. Inbound vs Outbound 30d
  WITH days AS (
    SELECT generate_series(
      (CURRENT_DATE - INTERVAL '29 days')::date,
      CURRENT_DATE,
      '1 day'
    )::date AS d
  ),
  inbound AS (
    SELECT date_trunc('day', grn.created_at)::date AS d,
           COALESCE(SUM(gi.quantity_received), 0) AS qty
    FROM grn_items gi
    JOIN goods_receipt_notes grn ON grn.id = gi.grn_id
    WHERE (p_company_id IS NULL OR grn.company_id = p_company_id)
      AND grn.created_at >= (CURRENT_DATE - INTERVAL '29 days')
    GROUP BY 1
  ),
  outbound AS (
    SELECT date_trunc('day', mi.created_at)::date AS d,
           COALESCE(SUM(mii.quantity_issued), 0) AS qty
    FROM material_issue_items mii
    JOIN material_issue_notes mi ON mi.id = mii.min_id
    WHERE (p_company_id IS NULL OR mi.company_id = p_company_id)
      AND mi.created_at >= (CURRENT_DATE - INTERVAL '29 days')
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'd', to_char(days.d, 'YYYY-MM-DD'),
    'inbound', COALESCE(inb.qty, 0),
    'outbound', COALESCE(o.qty, 0)
  ) ORDER BY days.d)
  INTO v_inbound_outbound
  FROM days
  LEFT JOIN inbound inb ON inb.d = days.d
  LEFT JOIN outbound o ON o.d = days.d;

  -- 3. Top 5 Issued 30d
  WITH agg AS (
    SELECT mii.item_id, SUM(mii.quantity_issued) AS qty
    FROM material_issue_items mii
    JOIN material_issue_notes mi ON mi.id = mii.min_id
    WHERE (p_company_id IS NULL OR mi.company_id = p_company_id)
      AND mi.created_at >= (CURRENT_DATE - INTERVAL '29 days')
      AND mii.item_id IS NOT NULL
    GROUP BY mii.item_id
    ORDER BY qty DESC NULLS LAST
    LIMIT 5
  )
  SELECT jsonb_agg(jsonb_build_object(
    'item_id', agg.item_id,
    'name', COALESCE(wif.name, wif.item_code, 'Unknown'),
    'item_code', wif.item_code,
    'qty', agg.qty
  ) ORDER BY agg.qty DESC)
  INTO v_top_issued
  FROM agg
  LEFT JOIN warehouse_items_full wif ON wif.id = agg.item_id;

  -- 4. Top 5 Returned 30d
  WITH agg AS (
    SELECT mri.item_id, SUM(mri.quantity_returned) AS qty
    FROM material_return_items mri
    JOIN material_return_notes mr ON mr.id = mri.mrn_id
    WHERE (p_company_id IS NULL OR mr.company_id = p_company_id)
      AND mr.created_at >= (CURRENT_DATE - INTERVAL '29 days')
      AND mri.item_id IS NOT NULL
    GROUP BY mri.item_id
    ORDER BY qty DESC NULLS LAST
    LIMIT 5
  )
  SELECT jsonb_agg(jsonb_build_object(
    'item_id', agg.item_id,
    'name', COALESCE(wif.name, wif.item_code, 'Unknown'),
    'item_code', wif.item_code,
    'qty', agg.qty
  ) ORDER BY agg.qty DESC)
  INTO v_top_returned
  FROM agg
  LEFT JOIN warehouse_items_full wif ON wif.id = agg.item_id;

  -- 5. Stock Movement Mix 7d
  SELECT jsonb_agg(jsonb_build_object(
    'type', transaction_type,
    'count', cnt
  ))
  INTO v_movement_mix
  FROM (
    SELECT transaction_type, COUNT(*) AS cnt
    FROM stock_transactions
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
      AND created_at >= (CURRENT_DATE - INTERVAL '6 days')
    GROUP BY transaction_type
    ORDER BY cnt DESC
  ) t;

  -- 6. PO Spend Trend 12w
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', CURRENT_DATE - INTERVAL '11 weeks')::date,
      date_trunc('week', CURRENT_DATE)::date,
      '1 week'
    )::date AS w
  ),
  spend AS (
    SELECT date_trunc('week', po_date)::date AS w,
           COALESCE(SUM(COALESCE(final_amount, total_amount, 0)), 0) AS amt
    FROM purchase_orders
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
      AND po_date >= date_trunc('week', CURRENT_DATE - INTERVAL '11 weeks')::date
      AND status NOT IN ('cancelled', 'rejected')
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'w', to_char(weeks.w, 'YYYY-MM-DD'),
    'amount', COALESCE(s.amt, 0)
  ) ORDER BY weeks.w)
  INTO v_spend_trend
  FROM weeks
  LEFT JOIN spend s ON s.w = weeks.w;

  RETURN jsonb_build_object(
    'material_flow', COALESCE(v_material_flow, '[]'::jsonb),
    'inbound_outbound', COALESCE(v_inbound_outbound, '[]'::jsonb),
    'top_issued', COALESCE(v_top_issued, '[]'::jsonb),
    'top_returned', COALESCE(v_top_returned, '[]'::jsonb),
    'movement_mix', COALESCE(v_movement_mix, '[]'::jsonb),
    'spend_trend', COALESCE(v_spend_trend, '[]'::jsonb)
  );
END;
$$;
