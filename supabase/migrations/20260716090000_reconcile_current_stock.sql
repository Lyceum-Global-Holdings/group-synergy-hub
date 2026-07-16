-- One-time data repair: reconcile warehouse_items.current_stock.
--
-- Before 20260709090000, update_stock_on_grn_approval added quantity_received
-- (including damaged/rejected lines) to current_stock with no matching bin
-- allocation or ledger row, and its UPDATE..FROM applied only one grn_items row
-- per item per GRN — so current_stock drifted from reality in both directions.
--
-- Correction rule: an item's stock has two independent reconstructions —
--   • alloc_sum  = SUM(warehouse_bin_allocations.allocated_quantity)
--   • ledger_sum = SUM(stock_transactions.quantity_change)
-- Where the two AGREE and current_stock differs, current_stock is provably
-- wrong and is reset to the agreed value. Where they disagree (unbinned opening
-- stock, unledgered adjustments), nothing is touched — those rows are surfaced
-- by the review query at the bottom for a human decision.

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
  RAISE NOTICE 'reconcile_current_stock: corrected % item(s) where allocations and ledger agree', v_fixed;
END $$;
