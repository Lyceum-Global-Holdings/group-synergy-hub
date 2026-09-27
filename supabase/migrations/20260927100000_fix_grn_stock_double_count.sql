-- Fix: approving a GRN added the accepted quantity to on-hand stock twice.
--
-- approve_grn_with_allocations() writes every accepted line into
-- warehouse_bin_allocations, and trg_sync_item_stock_after_bin_allocation then
-- sets warehouse_items.current_stock = SUM(allocated_quantity) — which already
-- includes the receipt. The RPC then flips the GRN to 'approved', which fired
-- the legacy grn_approval_stock_update_trigger (20250923062132) →
-- update_stock_on_grn_approval(), adding the accepted quantity a second time.
-- 20260709090000 narrowed that function to accepted qty but kept the add.
-- The excess lasted until the item's next allocation change re-summed its bins.
--
-- Bin allocations are the source of truth for on-hand stock, so the legacy
-- trigger is removed rather than patched.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Remove the legacy trigger. Matched by function, not name, in case it was
--    re-created under another name.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.goods_receipt_notes'::regclass
      AND p.proname = 'update_stock_on_grn_approval'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.goods_receipt_notes', r.tgname);
    RAISE NOTICE 'fix_grn_stock_double_count: dropped trigger %', r.tgname;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.update_stock_on_grn_approval();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Repair inflated stock. Same rule as 20260716090000: an item's stock has two
--    independent reconstructions (bin allocations and the movement ledger).
--    Where they AGREE and current_stock differs, current_stock is provably
--    wrong and is reset. Where they disagree, nothing is touched — see the
--    review query below.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_fixed int;
BEGIN
  WITH ledger AS (
    SELECT item_id, ROUND(SUM(quantity_change)::numeric, 6) AS ledger_sum
    FROM public.stock_transactions
    GROUP BY item_id
  ),
  alloc AS (
    SELECT warehouse_item_id, ROUND(SUM(allocated_quantity)::numeric, 6) AS alloc_sum
    FROM public.warehouse_bin_allocations
    GROUP BY warehouse_item_id
  ),
  agreed AS (
    SELECT a.warehouse_item_id AS item_id, a.alloc_sum AS true_stock
    FROM alloc a
    JOIN ledger l ON l.item_id = a.warehouse_item_id
    WHERE l.ledger_sum = a.alloc_sum
  )
  UPDATE public.warehouse_items wi
     SET current_stock = g.true_stock,
         updated_at = now()
    FROM agreed g
   WHERE wi.id = g.item_id
     AND ROUND(COALESCE(wi.current_stock, 0)::numeric, 6) <> g.true_stock;

  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RAISE NOTICE 'fix_grn_stock_double_count: corrected % item(s)', v_fixed;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only checks (run separately in the SQL editor).
--
-- 0) Preview, BEFORE applying — the items step 2 will correct:
--    WITH ledger AS (
--      SELECT item_id, ROUND(SUM(quantity_change)::numeric, 6) AS ledger_sum
--      FROM public.stock_transactions GROUP BY item_id
--    ), alloc AS (
--      SELECT warehouse_item_id, ROUND(SUM(allocated_quantity)::numeric, 6) AS alloc_sum
--      FROM public.warehouse_bin_allocations GROUP BY warehouse_item_id
--    )
--    SELECT co.name AS company, c.item_code, c.name AS item_name,
--           wi.current_stock AS shown_now, a.alloc_sum AS corrected_to,
--           wi.current_stock - a.alloc_sum AS excess
--      FROM public.warehouse_items wi
--      JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
--      LEFT JOIN public.companies co ON co.id = wi.company_id
--      JOIN alloc a ON a.warehouse_item_id = wi.id
--      JOIN ledger l ON l.item_id = wi.id
--     WHERE l.ledger_sum = a.alloc_sum
--       AND ROUND(COALESCE(wi.current_stock, 0)::numeric, 6) <> a.alloc_sum
--     ORDER BY excess DESC;
--
-- a) Trigger gone — expect 0 rows:
--    SELECT tgname FROM pg_trigger
--     WHERE tgrelid = 'public.goods_receipt_notes'::regclass
--       AND tgname = 'grn_approval_stock_update_trigger';
--
-- b) Items still needing a human decision: bins and ledger disagree. A positive
--    bins_minus_ledger with a recent GRN can mean Stock Audit "Fix" copied an
--    inflated total into the bins; negative usually means stock left without
--    touching bins (e.g. construction room issues).
--    WITH ledger AS (
--      SELECT item_id, ROUND(SUM(quantity_change)::numeric, 6) AS ledger_sum
--      FROM public.stock_transactions GROUP BY item_id
--    ), alloc AS (
--      SELECT warehouse_item_id, ROUND(SUM(allocated_quantity)::numeric, 6) AS alloc_sum
--      FROM public.warehouse_bin_allocations GROUP BY warehouse_item_id
--    )
--    SELECT co.name AS company, c.item_code, c.name AS item_name,
--           wi.current_stock, a.alloc_sum, l.ledger_sum,
--           a.alloc_sum - l.ledger_sum AS bins_minus_ledger,
--           (SELECT MAX(g.approved_date) FROM public.grn_items gi
--              JOIN public.goods_receipt_notes g ON g.id = gi.grn_id
--             WHERE gi.warehouse_item_id = wi.id AND g.status = 'approved') AS last_grn_approved
--      FROM public.warehouse_items wi
--      JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
--      LEFT JOIN public.companies co ON co.id = wi.company_id
--      JOIN alloc a ON a.warehouse_item_id = wi.id
--      JOIN ledger l ON l.item_id = wi.id
--     WHERE a.alloc_sum <> l.ledger_sum
--     ORDER BY ABS(a.alloc_sum - l.ledger_sum) DESC;
-- ─────────────────────────────────────────────────────────────────────────────
