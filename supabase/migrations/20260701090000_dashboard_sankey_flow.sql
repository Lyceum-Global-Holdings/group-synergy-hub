-- Compact multi-stage material-flow Sankey for the dashboard:
--   GRN + Returns ─► Location ─► Product ─► Issues   (30d quantities, company-scoped)
-- Left three columns follow the INBOUND flow (GRN+Returns), attributed to the
-- root location then to the catalog product (conserved). The Product→Issues
-- column shows OUTBOUND issues per product. Top 4 locations + 'Other',
-- top 6 products + 'Other', so the diagram stays small.

CREATE OR REPLACE FUNCTION public.get_dashboard_sankey_flow(
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
  v jsonb;
  TOP_LOC  constant int := 4;
  TOP_PROD constant int := 6;
BEGIN
  WITH mov AS (
    SELECT public.get_root_location_id(grn.location_id) AS loc, gi.catalog_item_id AS cid,
           gi.quantity_received::numeric AS g, 0::numeric AS r, 0::numeric AS i
    FROM grn_items gi JOIN goods_receipt_notes grn ON grn.id = gi.grn_id
    WHERE grn.company_id = p_company_id AND grn.created_at >= (CURRENT_DATE - INTERVAL '29 days')
    UNION ALL
    SELECT public.get_root_location_id(mr.location_id), wi.catalog_item_id, 0, mri.quantity_returned, 0
    FROM material_return_items mri JOIN material_return_notes mr ON mr.id = mri.mrn_id
      LEFT JOIN warehouse_items wi ON wi.id = mri.item_id
    WHERE mr.company_id = p_company_id AND mr.created_at >= (CURRENT_DATE - INTERVAL '29 days')
    UNION ALL
    SELECT public.get_root_location_id(mi.location_id), wi.catalog_item_id, 0, 0, mii.quantity_issued
    FROM material_issue_items mii JOIN material_issue_notes mi ON mi.id = mii.min_id
      LEFT JOIN warehouse_items wi ON wi.id = mii.item_id
    WHERE mi.company_id = p_company_id AND mi.created_at >= (CURRENT_DATE - INTERVAL '29 days')
  ),
  loc_rank AS (
    SELECT loc, ROW_NUMBER() OVER (ORDER BY SUM(g + r) DESC) AS rn
    FROM mov GROUP BY loc HAVING SUM(g + r) > 0
  ),
  prod_rank AS (
    SELECT cid, ROW_NUMBER() OVER (ORDER BY SUM(g + r + i) DESC) AS rn
    FROM mov GROUP BY cid HAVING SUM(g + r + i) > 0
  ),
  b AS (
    SELECT
      CASE WHEN lr.rn <= TOP_LOC THEN COALESCE(m.loc::text, 'unassigned') ELSE 'other_loc' END AS loc_key,
      CASE WHEN pr.rn <= TOP_PROD THEN COALESCE(m.cid::text, 'unknown') ELSE 'other_prod' END AS prod_key,
      m.g, m.r, m.i
    FROM mov m
    LEFT JOIN loc_rank lr ON lr.loc IS NOT DISTINCT FROM m.loc
    LEFT JOIN prod_rank pr ON pr.cid IS NOT DISTINCT FROM m.cid
  ),
  loc_agg AS (
    SELECT loc_key, SUM(g) AS grn, SUM(r) AS returns, SUM(g + r) AS inbound
    FROM b GROUP BY loc_key
  ),
  prod_agg AS (
    SELECT prod_key, SUM(i) AS issues, SUM(g + r + i) AS activity
    FROM b GROUP BY prod_key
  ),
  lp AS (
    SELECT loc_key, prod_key, SUM(g + r) AS v
    FROM b GROUP BY loc_key, prod_key HAVING SUM(g + r) > 0
  )
  SELECT jsonb_build_object(
    'locations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', la.loc_key,
        'name', CASE la.loc_key WHEN 'other_loc' THEN 'Other' WHEN 'unassigned' THEN 'Unassigned'
                               ELSE COALESCE(wl.name, 'Unknown') END,
        'grn', ROUND(la.grn, 2), 'returns', ROUND(la.returns, 2)
      ) ORDER BY (la.loc_key = 'other_loc'), la.inbound DESC), '[]'::jsonb)
      FROM loc_agg la LEFT JOIN warehouse_locations wl ON wl.id::text = la.loc_key
    ),
    'products', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', pa.prod_key,
        'name', CASE pa.prod_key WHEN 'other_prod' THEN 'Other' WHEN 'unknown' THEN 'Unknown'
                                ELSE COALESCE(cat.name, cat.item_code, 'Unknown') END,
        'issues', ROUND(pa.issues, 2)
      ) ORDER BY (pa.prod_key = 'other_prod'), pa.activity DESC), '[]'::jsonb)
      FROM prod_agg pa LEFT JOIN warehouse_item_catalog cat ON cat.id::text = pa.prod_key
    ),
    'links', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('l', lp.loc_key, 'p', lp.prod_key, 'v', ROUND(lp.v, 2))), '[]'::jsonb)
      FROM lp
    )
  )
  INTO v;

  RETURN COALESCE(v, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_sankey_flow(uuid, uuid) TO authenticated;
