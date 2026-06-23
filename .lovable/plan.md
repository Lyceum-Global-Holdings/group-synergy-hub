## Goal

Make the **Item Master** the single source of truth for **Unit Cost**, and ensure every approved GRN refreshes that master price (so the value the user sees on `/warehouse/item-bin-master` always reflects the most recent purchase, regardless of which company received it).

## Current state

- `warehouse_item_catalog.unit_cost` — master price (one row per item, global).
- `warehouse_items.unit_cost` — per-company cached copy.
- `warehouse_item_price_history` + trigger `sync_item_price_on_grn_approval` already write the GRN unit price to **both** the catalog and the per-company `warehouse_items` row on GRN approval/completion.
- The Item Master tab reads via RPC `list_warehouse_inventory`, which currently returns `wi.unit_cost` (per-company only). So items that were never received by the active company show "—" even when the master has a price. That is the gap visible in the screenshot.

## Plan

### 1. Make Item Master read the master price (one DB migration)

Update `public.list_warehouse_inventory` so the returned `unit_cost` is:

```
COALESCE(NULLIF(cat.unit_cost, 0), NULLIF(wi.unit_cost, 0), 0)
```

- Master (`catalog.unit_cost`) wins.
- Falls back to the per-company cached cost for legacy rows where the master is still empty.
- Same change applied to `selling_price` for consistency (catalog already holds the master selling price).
- No signature change, no client change required — the column just starts showing the master value.

### 2. Strengthen the GRN → master sync trigger

Tighten `sync_item_price_on_grn_approval` (same file pattern as `20260611040647`):

- Use the **latest GRN line** per `catalog_item_id` within the batch (currently it just loops, so the last one wins — make that explicit and ordered by `grn_date, created_at` so behaviour is deterministic when one GRN has multiple lines for the same item).
- Always set `warehouse_item_catalog.last_purchase_price`, `last_purchase_date`, `last_purchase_supplier_id`, `last_purchase_grn_id` (new columns) **in addition to** `unit_cost`. Keeping `unit_cost` as the working master price and `last_purchase_*` as audit-friendly metadata matches SAP MM "Moving Avg / Last PO Price" pattern.
- Continue to mirror `unit_cost` onto `warehouse_items` for any code that still reads it (FIFO valuation, MIN PDF, stock reconciliation).

### 3. Backfill

Inside the same migration:

- Refresh `warehouse_item_catalog.unit_cost` + `last_purchase_*` from the most recent row in `warehouse_item_price_history` per `catalog_item_id`.
- Refresh `warehouse_items.unit_cost` from the catalog where it is currently NULL/0.

### 4. UI touch-ups (Item Master tab only)

`src/pages/warehouse/ItemBinMaster.tsx` / list cell:

- Tooltip on the Unit Cost cell: "Last purchase price — GRN <grn_number> on <date> from <supplier>". Data already returned by the RPC after step 2 (add `last_purchase_date`, `last_purchase_supplier_name`, `last_purchase_grn_number` to the RETURNS TABLE; thread through `useWarehouseInventoryPage`).
- No other surfaces change. MIN/GRN/MRN PDFs, valuation reports, and three-way match continue to use the per-company `warehouse_items.unit_cost` they already use.

## Out of scope

- Switching valuation method (FIFO / moving-average) — not requested.
- Editing master price manually from the inventory tab (already possible via "Edit item" dialog which writes to the catalog).
- Selling price workflow.

## Technical notes

- Files touched:
  - **New migration** `supabase/migrations/<ts>_item_master_unit_cost_source_of_truth.sql` — adds `last_purchase_*` columns to `warehouse_item_catalog`, updates the trigger, updates `list_warehouse_inventory`, backfills.
  - `src/hooks/warehouse/useWarehouseInventoryPage.ts` — extend row type with new fields.
  - `src/pages/warehouse/ItemBinMaster.tsx` (Unit Cost cell) — tooltip.
- No RLS / grant changes (no new tables).
- Respects existing memories: `warehouse-catalog-source-of-truth`, `warehouse-inventory-server-pagination`, `list-rpc-pattern`.
