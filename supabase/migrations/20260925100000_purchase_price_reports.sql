-- ============================================================================
-- Purchase Price Intelligence reports (Reports Center → Procurement)
--
--   PR-PRC-TRD-001  report_purchase_price_trend        1 / 3 / 6 / 12-month price trend per product
--   PR-PRC-HIS-001  report_purchase_history            line-level purchase ledger
--   PR-PRC-SUP-001  report_supplier_price_comparison   product × supplier benchmark
--
-- All three read one guarded fact source, purchase_price_facts(), with two bases:
--   received — GRN lines as booked on approval (warehouse_item_price_history):
--              net of line + document discounts, accepted quantity (IAS 2 §10-11)
--   ordered  — approved PO lines, PO header discount pro-rated across lines
--
-- Standards: IAS 2 (cost of purchase, weighted average), IAS 21 (spot-rate
-- translation to the company base currency on the transaction date),
-- ISO 8601 (dates, P1M/P3M/P6M/P12M windows), ISO 4217 (currency codes).
-- Prices exclude recoverable tax and freight (see the Freight Cost reports).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fact source
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because po_items is readable only by a PO's creator/buyer;
-- the guard below enforces company access plus a purchasing-related role
-- (same role set as the purchase_orders read policy) before returning rows.
CREATE OR REPLACE FUNCTION public.purchase_price_facts(
  p_company_id      uuid,
  p_basis           text DEFAULT 'received',
  p_date_from       date DEFAULT NULL,
  p_date_to         date DEFAULT NULL,
  p_catalog_item_id uuid DEFAULT NULL,
  p_category_id     uuid DEFAULT NULL,
  p_supplier_id     uuid DEFAULT NULL,
  p_location_id     uuid DEFAULT NULL
)
RETURNS TABLE (
  line_id             uuid,
  txn_date            date,
  doc_number          text,
  po_number           text,
  supplier_id         uuid,
  supplier_name       text,
  product_key         text,
  catalog_item_id     uuid,
  item_code           text,
  item_name           text,
  uom                 text,
  quantity            numeric,
  gross_unit_price    numeric,
  net_unit_price      numeric,
  txn_currency        text,
  fx_rate             numeric,
  net_unit_price_base numeric,
  line_value_base     numeric,
  unlinked            boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid  uuid := auth.uid();
  v_base text;
BEGIN
  IF p_company_id IS NULL OR v_uid IS NULL
     OR NOT public.can_access_company(p_company_id)
     OR NOT (
          public.has_procurement_access(v_uid)
       OR public.has_finance_access(v_uid)
       OR public.has_warehouse_access(v_uid)
       OR public.has_manager_access(v_uid)
       OR public.is_admin_or_higher(v_uid)
     ) THEN
    RAISE EXCEPTION 'Not authorised to view purchase prices for this company'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_basis, 'received') NOT IN ('received', 'ordered') THEN
    RAISE EXCEPTION 'Unknown price basis "%": use received or ordered', p_basis
      USING ERRCODE = '22023';
  END IF;

  SELECT upper(gs.base_currency) INTO v_base
  FROM public.gl_settings gs
  WHERE gs.company_id = p_company_id;
  v_base := COALESCE(v_base, 'LKR');

  RETURN QUERY
  WITH RECURSIVE cats AS (
    SELECT ic.id FROM public.item_categories ic WHERE ic.id = p_category_id
    UNION
    SELECT ic.id FROM public.item_categories ic JOIN cats ON ic.parent_id = cats.id
  ),
  lines AS (
    -- Received: one row per accepted GRN line, written on GRN approval.
    SELECT
      h.id                                                   AS lid,
      g.grn_date::date                                       AS d,
      g.grn_number::text                                     AS doc,
      COALESCE(h.po_number, po.po_number)::text              AS po_no,
      COALESCE(h.supplier_id, g.supplier_id)                 AS sup_id,
      COALESCE(h.supplier_name, g.supplier_name)::text       AS sup_name,
      h.catalog_item_id                                      AS cat_item,
      COALESCE(c.item_code, gi.item_code)::text              AS code,
      COALESCE(c.name, gi.item_name)::text                   AS nm,
      c.category_id                                          AS cat,
      lower(COALESCE(NULLIF(trim(gi.unit_of_measure), ''), 'unit'))::text AS u,
      h.quantity_received::numeric                           AS qty,
      COALESCE(gi.unit_price, h.unit_price)::numeric         AS gross,
      -- Rows backfilled before net pricing existed only carry unit_price.
      COALESCE(h.net_unit_price, h.unit_price)::numeric      AS net,
      upper(COALESCE(NULLIF(h.currency, ''), NULLIF(po.currency, ''), v_base))::text AS cur
    FROM public.warehouse_item_price_history h
    JOIN public.goods_receipt_notes g ON g.id = h.grn_id
    LEFT JOIN public.grn_items gi ON gi.id = h.grn_item_id
    LEFT JOIN public.purchase_orders po ON po.id = COALESCE(h.po_id, g.po_id)
    LEFT JOIN public.warehouse_item_catalog c ON c.id = h.catalog_item_id
    WHERE COALESCE(p_basis, 'received') = 'received'
      AND h.company_id = p_company_id
      AND g.status IN ('approved', 'completed')
      AND (p_date_from IS NULL OR g.grn_date >= p_date_from)
      AND (p_date_to   IS NULL OR g.grn_date <= p_date_to)
      AND (p_location_id IS NULL OR g.location_id = p_location_id)

    UNION ALL

    -- Ordered: committed PO lines. POs carry no location, so p_location_id
    -- does not apply to this basis.
    SELECT
      pi.id,
      COALESCE(po.approved_date::date, po.po_date)::date,
      po.po_number::text,
      po.po_number::text,
      po.supplier_id,
      s.name::text,
      wi.catalog_item_id,
      COALESCE(c.item_code, pi.item_code)::text,
      COALESCE(c.name, pi.item_name)::text,
      c.category_id,
      lower(COALESCE(NULLIF(trim(pi.unit_of_measure), ''), 'unit'))::text,
      pi.quantity_ordered::numeric,
      pi.unit_price::numeric,
      -- Header discount pro-rated by value (IAS 2: trade discounts reduce cost).
      (pi.unit_price * (1 - COALESCE(COALESCE(po.discount_amount, 0) / NULLIF(po.total_amount, 0), 0)))::numeric,
      upper(COALESCE(NULLIF(po.currency, ''), v_base))::text
    FROM public.po_items pi
    JOIN public.purchase_orders po ON po.id = pi.po_id
    LEFT JOIN public.suppliers s ON s.id = po.supplier_id
    LEFT JOIN public.warehouse_items wi ON wi.id = pi.warehouse_item_id
    LEFT JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
    WHERE p_basis = 'ordered'
      AND po.company_id = p_company_id
      AND po.status IN ('approved', 'sent', 'acknowledged', 'partially_received', 'completed')
      AND (p_date_from IS NULL OR COALESCE(po.approved_date::date, po.po_date) >= p_date_from)
      AND (p_date_to   IS NULL OR COALESCE(po.approved_date::date, po.po_date) <= p_date_to)
  )
  SELECT
    l.lid,
    l.d,
    l.doc,
    l.po_no,
    l.sup_id,
    COALESCE(l.sup_name, 'Unknown supplier'),
    -- Unlinked PO lines are grouped by their typed code (or name).
    COALESCE(l.cat_item::text, 'txt:' || lower(COALESCE(NULLIF(trim(l.code), ''), trim(l.nm)))),
    l.cat_item,
    l.code,
    l.nm,
    l.u,
    l.qty,
    round(l.gross, 6),
    round(l.net, 6),
    l.cur,
    fx.rate,
    round(l.net * fx.rate, 6),
    round(l.net * fx.rate * l.qty, 2),
    l.cat_item IS NULL
  FROM lines l
  -- IAS 21 §21-22: spot rate on (or latest before) the transaction date,
  -- company-specific rates preferred, inverse pair used when only that exists.
  -- No rate → NULL, so the line is excluded from base-currency aggregates
  -- rather than silently converted at 1.0.
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN l.cur = v_base THEN 1::numeric
      ELSE (
        SELECT r.rate FROM (
          SELECT er.exchange_rate AS rate, er.rate_date AS rd, (er.company_id IS NOT NULL) AS own, 0 AS inv
          FROM public.exchange_rates er
          WHERE upper(er.from_currency) = l.cur AND upper(er.to_currency) = v_base
            AND COALESCE(er.rate_type, 'spot') = 'spot'
            AND er.rate_date <= l.d AND er.exchange_rate > 0
            AND (er.company_id = p_company_id OR er.company_id IS NULL)
          UNION ALL
          SELECT 1 / er.exchange_rate, er.rate_date, (er.company_id IS NOT NULL), 1
          FROM public.exchange_rates er
          WHERE upper(er.from_currency) = v_base AND upper(er.to_currency) = l.cur
            AND COALESCE(er.rate_type, 'spot') = 'spot'
            AND er.rate_date <= l.d AND er.exchange_rate > 0
            AND (er.company_id = p_company_id OR er.company_id IS NULL)
        ) r
        ORDER BY r.rd DESC, r.own DESC, r.inv ASC
        LIMIT 1
      )
    END AS rate
  ) fx ON true
  WHERE (p_catalog_item_id IS NULL OR l.cat_item = p_catalog_item_id)
    AND (p_category_id IS NULL OR l.cat IN (SELECT cats.id FROM cats))
    AND (p_supplier_id IS NULL OR l.sup_id = p_supplier_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. PR-PRC-HIS-001 · Purchase History Ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_purchase_history(
  p_company_id      uuid,
  p_basis           text DEFAULT 'received',
  p_date_from       date DEFAULT NULL,
  p_date_to         date DEFAULT NULL,
  p_catalog_item_id uuid DEFAULT NULL,
  p_category_id     uuid DEFAULT NULL,
  p_supplier_id     uuid DEFAULT NULL,
  p_location_id     uuid DEFAULT NULL
)
RETURNS TABLE (
  txn_date            date,
  doc_number          text,
  po_number           text,
  supplier_name       text,
  item_code           text,
  item_name           text,
  uom                 text,
  quantity            numeric,
  txn_currency        text,
  gross_unit_price    numeric,
  discount_pct        numeric,
  net_unit_price      numeric,
  fx_rate             numeric,
  net_unit_price_base numeric,
  line_value_base     numeric,
  chg_vs_prev         numeric,
  unlinked            boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH f AS (
    SELECT * FROM public.purchase_price_facts(
      p_company_id, p_basis, p_date_from, p_date_to,
      p_catalog_item_id, p_category_id, p_supplier_id, p_location_id)
  ),
  -- Change vs the previous *priced* purchase of the same product and unit.
  prev AS (
    SELECT f.line_id,
           LAG(f.net_unit_price_base) OVER (
             PARTITION BY f.product_key, f.uom
             ORDER BY f.txn_date, f.doc_number, f.line_id
           ) AS p
    FROM f
    WHERE f.net_unit_price_base > 0
  )
  SELECT
    f.txn_date,
    f.doc_number,
    f.po_number,
    f.supplier_name,
    f.item_code,
    f.item_name,
    f.uom,
    f.quantity,
    f.txn_currency,
    f.gross_unit_price,
    CASE WHEN f.gross_unit_price > 0
         THEN round((f.gross_unit_price - f.net_unit_price) / f.gross_unit_price, 6) END,
    f.net_unit_price,
    f.fx_rate,
    f.net_unit_price_base,
    f.line_value_base,
    CASE WHEN prev.p > 0
         THEN round((f.net_unit_price_base - prev.p) / prev.p, 6) END,
    f.unlinked
  FROM f
  LEFT JOIN prev ON prev.line_id = f.line_id
  ORDER BY f.item_code NULLS LAST, f.item_name, f.uom, f.txn_date DESC, f.doc_number DESC
  LIMIT 50000;
$$;

-- ---------------------------------------------------------------------------
-- 3. PR-PRC-TRD-001 · Purchase Price Trend (1 / 3 / 6 / 12 months)
-- ---------------------------------------------------------------------------
-- Windows are ISO 8601 durations ending on the as-of date (inclusive):
--   1M = (as_of − P1M, as_of], … 12M = (as_of − P12M, as_of].
-- WAP = Σ(net price × qty) ÷ Σ qty over priced lines (IAS 2 §25).
CREATE OR REPLACE FUNCTION public.report_purchase_price_trend(
  p_company_id      uuid,
  p_basis           text DEFAULT 'received',
  p_as_of           date DEFAULT NULL,
  p_catalog_item_id uuid DEFAULT NULL,
  p_category_id     uuid DEFAULT NULL,
  p_supplier_id     uuid DEFAULT NULL,
  p_location_id     uuid DEFAULT NULL
)
RETURNS TABLE (
  item_code        text,
  item_name        text,
  uom              text,
  qty_1m           numeric,
  wap_1m           numeric,
  qty_3m           numeric,
  wap_3m           numeric,
  qty_6m           numeric,
  wap_6m           numeric,
  qty_12m          numeric,
  wap_12m          numeric,
  spend_12m        numeric,
  min_12m          numeric,
  max_12m          numeric,
  last_price       numeric,
  last_date        date,
  last_supplier    text,
  chg_last_vs_12m  numeric,
  chg_3m_vs_12m    numeric,
  volatility_12m   numeric,
  suppliers_12m    integer,
  lines_12m        integer,
  fx_missing       integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH a AS (
    SELECT COALESCE(p_as_of, current_date) AS as_of
  ),
  f AS (
    SELECT
      f.*,
      (f.net_unit_price_base > 0)                                AS priced,
      (f.txn_date > (a.as_of - interval '1 month')::date)        AS in1,
      (f.txn_date > (a.as_of - interval '3 months')::date)       AS in3,
      (f.txn_date > (a.as_of - interval '6 months')::date)       AS in6
    FROM a
    CROSS JOIN LATERAL public.purchase_price_facts(
      p_company_id, p_basis,
      ((a.as_of - interval '12 months')::date + 1), a.as_of,
      p_catalog_item_id, p_category_id, p_supplier_id, p_location_id) f
  ),
  g AS (
    SELECT
      max(f.item_code) AS item_code,
      max(f.item_name) AS item_name,
      f.uom,
      sum(f.quantity) FILTER (WHERE f.in1) AS qty_1m,
      sum(f.net_unit_price_base * f.quantity) FILTER (WHERE f.in1 AND f.priced)
        / NULLIF(sum(f.quantity) FILTER (WHERE f.in1 AND f.priced), 0) AS wap_1m,
      sum(f.quantity) FILTER (WHERE f.in3) AS qty_3m,
      sum(f.net_unit_price_base * f.quantity) FILTER (WHERE f.in3 AND f.priced)
        / NULLIF(sum(f.quantity) FILTER (WHERE f.in3 AND f.priced), 0) AS wap_3m,
      sum(f.quantity) FILTER (WHERE f.in6) AS qty_6m,
      sum(f.net_unit_price_base * f.quantity) FILTER (WHERE f.in6 AND f.priced)
        / NULLIF(sum(f.quantity) FILTER (WHERE f.in6 AND f.priced), 0) AS wap_6m,
      sum(f.quantity) AS qty_12m,
      sum(f.net_unit_price_base * f.quantity) FILTER (WHERE f.priced)
        / NULLIF(sum(f.quantity) FILTER (WHERE f.priced), 0) AS wap_12m,
      sum(f.line_value_base) FILTER (WHERE f.priced) AS spend_12m,
      min(f.net_unit_price_base) FILTER (WHERE f.priced) AS min_12m,
      max(f.net_unit_price_base) FILTER (WHERE f.priced) AS max_12m,
      (array_agg(f.net_unit_price_base ORDER BY f.txn_date DESC, f.doc_number DESC) FILTER (WHERE f.priced))[1] AS last_price,
      (array_agg(f.txn_date ORDER BY f.txn_date DESC, f.doc_number DESC) FILTER (WHERE f.priced))[1] AS last_date,
      (array_agg(f.supplier_name ORDER BY f.txn_date DESC, f.doc_number DESC) FILTER (WHERE f.priced))[1] AS last_supplier,
      -- Coefficient of variation of line prices (CIPS price-volatility measure).
      stddev_pop(f.net_unit_price_base) FILTER (WHERE f.priced)
        / NULLIF(avg(f.net_unit_price_base) FILTER (WHERE f.priced), 0) AS volatility_12m,
      count(DISTINCT f.supplier_id)::int AS suppliers_12m,
      count(*)::int AS lines_12m,
      count(*) FILTER (WHERE f.net_unit_price > 0 AND f.net_unit_price_base IS NULL)::int AS fx_missing
    FROM f
    GROUP BY f.product_key, f.uom
  )
  SELECT
    g.item_code,
    g.item_name,
    g.uom,
    g.qty_1m,  round(g.wap_1m, 4),
    g.qty_3m,  round(g.wap_3m, 4),
    g.qty_6m,  round(g.wap_6m, 4),
    g.qty_12m, round(g.wap_12m, 4),
    round(g.spend_12m, 2),
    round(g.min_12m, 4),
    round(g.max_12m, 4),
    round(g.last_price, 4),
    g.last_date,
    g.last_supplier,
    round((g.last_price - g.wap_12m) / NULLIF(g.wap_12m, 0), 6),
    round((g.wap_3m - g.wap_12m) / NULLIF(g.wap_12m, 0), 6),
    round(g.volatility_12m, 6),
    g.suppliers_12m,
    g.lines_12m,
    g.fx_missing
  FROM g
  ORDER BY g.spend_12m DESC NULLS LAST, g.item_code NULLS LAST, g.item_name
  LIMIT 50000;
$$;

-- ---------------------------------------------------------------------------
-- 4. PR-PRC-SUP-001 · Supplier Price Comparison
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_supplier_price_comparison(
  p_company_id      uuid,
  p_basis           text DEFAULT 'received',
  p_date_from       date DEFAULT NULL,
  p_date_to         date DEFAULT NULL,
  p_catalog_item_id uuid DEFAULT NULL,
  p_category_id     uuid DEFAULT NULL,
  p_location_id     uuid DEFAULT NULL
)
RETURNS TABLE (
  item_code     text,
  item_name     text,
  uom           text,
  supplier_name text,
  lines         integer,
  quantity      numeric,
  qty_share     numeric,
  wap           numeric,
  last_price    numeric,
  last_date     date,
  min_price     numeric,
  vs_best_pct   numeric,
  price_rank    integer,
  spend         numeric,
  fx_missing    integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH f AS (
    SELECT f.*, (f.net_unit_price_base > 0) AS priced
    FROM public.purchase_price_facts(
      p_company_id, p_basis, p_date_from, p_date_to,
      p_catalog_item_id, p_category_id, NULL, p_location_id) f
  ),
  s AS (
    SELECT
      f.product_key,
      f.uom,
      f.supplier_id,
      max(f.supplier_name) AS supplier_name,
      max(f.item_code) AS item_code,
      max(f.item_name) AS item_name,
      count(*)::int AS lines,
      sum(f.quantity) AS quantity,
      sum(f.net_unit_price_base * f.quantity) FILTER (WHERE f.priced)
        / NULLIF(sum(f.quantity) FILTER (WHERE f.priced), 0) AS wap,
      (array_agg(f.net_unit_price_base ORDER BY f.txn_date DESC, f.doc_number DESC) FILTER (WHERE f.priced))[1] AS last_price,
      max(f.txn_date) AS last_date,
      min(f.net_unit_price_base) FILTER (WHERE f.priced) AS min_price,
      sum(f.line_value_base) FILTER (WHERE f.priced) AS spend,
      count(*) FILTER (WHERE f.net_unit_price > 0 AND f.net_unit_price_base IS NULL)::int AS fx_missing
    FROM f
    GROUP BY f.product_key, f.uom, f.supplier_id
  )
  SELECT
    s.item_code,
    s.item_name,
    s.uom,
    s.supplier_name,
    s.lines,
    s.quantity,
    round(s.quantity / NULLIF(sum(s.quantity) OVER (PARTITION BY s.product_key, s.uom), 0), 6),
    round(s.wap, 4),
    round(s.last_price, 4),
    s.last_date,
    round(s.min_price, 4),
    round((s.wap - min(s.wap) OVER (PARTITION BY s.product_key, s.uom))
          / NULLIF(min(s.wap) OVER (PARTITION BY s.product_key, s.uom), 0), 6),
    (rank() OVER (PARTITION BY s.product_key, s.uom ORDER BY s.wap ASC NULLS LAST))::int,
    round(s.spend, 2),
    s.fx_missing
  FROM s
  ORDER BY s.item_code NULLS LAST, s.item_name, s.uom,
           13,  -- price_rank
           s.supplier_name
  LIMIT 50000;
$$;

-- ---------------------------------------------------------------------------
-- 5. Privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.purchase_price_facts(uuid, text, date, date, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_purchase_history(uuid, text, date, date, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_purchase_price_trend(uuid, text, date, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_supplier_price_comparison(uuid, text, date, date, uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.purchase_price_facts(uuid, text, date, date, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_purchase_history(uuid, text, date, date, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_purchase_price_trend(uuid, text, date, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_supplier_price_comparison(uuid, text, date, date, uuid, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Close the cross-company read on warehouse_item_price_history
-- ---------------------------------------------------------------------------
-- Previously any authenticated user could read every company's purchase
-- prices. Writes come from sync_item_price_on_grn_approval(), which is
-- SECURITY DEFINER, so only reads change here.
DROP POLICY IF EXISTS "Authenticated users can read price history" ON public.warehouse_item_price_history;
DROP POLICY IF EXISTS "Company members can read price history" ON public.warehouse_item_price_history;
CREATE POLICY "Company members can read price history"
  ON public.warehouse_item_price_history
  FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));

-- ---------------------------------------------------------------------------
-- 7. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_po_date
  ON public.purchase_orders (company_id, po_date);
CREATE INDEX IF NOT EXISTS idx_wiph_company_item_received
  ON public.warehouse_item_price_history (company_id, catalog_item_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON public.exchange_rates (from_currency, to_currency, rate_type, rate_date DESC);

-- ---------------------------------------------------------------------------
-- 8. Verification (read-only — run after applying, as a signed-in user or
--    with the company id substituted; not executed by this migration)
-- ---------------------------------------------------------------------------
-- a) Functions exist:
--    SELECT proname FROM pg_proc WHERE proname IN ('purchase_price_facts',
--      'report_purchase_history','report_purchase_price_trend','report_supplier_price_comparison');
--
-- b) Hand-computed 12M weighted average for one item vs the report
--    (replace <company> and <item>; base-currency lines only):
--    SELECT sum(coalesce(h.net_unit_price, h.unit_price) * h.quantity_received)
--           / nullif(sum(h.quantity_received), 0) AS wap_12m_manual
--    FROM warehouse_item_price_history h
--    JOIN goods_receipt_notes g ON g.id = h.grn_id
--    WHERE h.company_id = '<company>' AND h.catalog_item_id = '<item>'
--      AND g.status IN ('approved','completed')
--      AND g.grn_date > current_date - interval '12 months'
--      AND coalesce(h.net_unit_price, h.unit_price) > 0;
--    -- compare with wap_12m from:
--    -- SELECT * FROM report_purchase_price_trend('<company>', 'received', current_date, '<item>');
--
-- c) Policy swap took effect:
--    SELECT policyname, qual FROM pg_policies WHERE tablename = 'warehouse_item_price_history';
