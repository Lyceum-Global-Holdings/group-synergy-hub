# Fix: `column wi.item_code does not exist` (permanent)

## Root cause

Stage 6b dropped the mirrored master columns (`item_code`, `name`, `description`, `category_id`, `unit_id`, brand, etc.) from `public.warehouse_items`. Those fields now live in `warehouse_item_catalog`, accessible via the `warehouse_items_full` view.

Several `report_*` DB functions still SELECT `wi.item_code` / `wi.name` / `wi.unit_id` from `warehouse_items wi`, so any report touching them aborts with `column wi.item_code does not exist`. Confirmed affected functions:

- `report_stock_on_hand`
- `report_inventory_valuation`
- `report_inventory_aging`
- `report_abc_classification`
- `report_cycle_count_variance`
- `report_batch_traceability`
- `report_stock_movement_ledger`
- `calculate_inventory_valuation`
- `stock_audit_summary`
- `stock_audit_summary_by_location`
- `reconcile_stock_batch`

## Permanent fix

Rewrite each function in one migration to read master fields from `public.warehouse_items_full` (the post-Stage-6b view that already merges `warehouse_items` + `warehouse_item_catalog`) instead of bare `warehouse_items`. The view exposes `item_code`, `name`, `description`, `category_id`, `unit_id`, `brand`, etc. as before, so the rewrites are mechanical:

```text
FROM warehouse_items wi   →   FROM warehouse_items_full wi
JOIN warehouse_items wi   →   JOIN warehouse_items_full wi
```

No column alias changes, no signature changes, no client changes.

## Steps

1. Migration `phase_6b_report_fns_use_view.sql`
   - For each function above: `CREATE OR REPLACE FUNCTION` with the existing signature and body, only swapping `warehouse_items` → `warehouse_items_full` everywhere the alias `wi` (or equivalent) is used to read master fields. Keep `warehouse_items` where the function writes to it (`UPDATE warehouse_items SET current_stock = …`) — only reads change.
   - Re-grant `EXECUTE` to `authenticated` to match current grants.
2. Add a one-off audit query in the migration comment so future regressions are easy to spot:
   ```sql
   -- SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
   -- WHERE n.nspname='public' AND pg_get_functiondef(p.oid) ~ 'warehouse_items\s+wi'
   --   AND pg_get_functiondef(p.oid) ~ 'wi\.(item_code|name|description|category_id|unit_id|brand|manufacturer|barcode|sku)';
   ```
3. Update memory (`mem://architecture/warehouse-catalog-source-of-truth` or the Stage 6b note) with a Core-level rule: **"Server-side functions reading item master fields must FROM `warehouse_items_full`, not `warehouse_items`."**
4. Verify by re-running the failing report from `/reports-center` (and `/admin/performance`) and by re-querying the audit SELECT — it should return 0 rows.

## Out of scope

- No changes to `warehouse_items` schema, RLS, triggers, or client hooks.
- Tool Management Phase 2c (drop legacy tool tables) is unaffected.
