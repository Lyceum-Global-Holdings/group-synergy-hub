# Last GRN Unit Price & Price History

Align with international ERP standards (SAP MM "Last Purchase Price" / Oracle Cost Mgmt PO history) — when a GRN is approved/completed, the receiving item's last purchase price is auto-updated, and a full per-receipt price history is preserved and viewable from item details.

## What we'll build

### 1. Price history table (new)
`warehouse_item_price_history` — one immutable row per accepted GRN line:
- item refs: `catalog_item_id`, `warehouse_item_id`, `company_id`
- source: `grn_id`, `grn_item_id`, `grn_number`, `grn_date`
- supplier: `supplier_id`, `supplier_name`
- pricing: `unit_price`, `quantity_received`, `total_cost`, `currency` (default company)
- po linkage: `po_id`, `po_number`
- `received_at`, `created_by`

RLS: company-scoped read for `authenticated`; writes only via the trigger (SECURITY DEFINER). GRANTs follow project standard.

Indexes: `(catalog_item_id, received_at DESC)` and `(warehouse_item_id, received_at DESC)` for fast "latest first" lookups.

### 2. Auto-update trigger
`sync_item_price_on_grn_approval()` — `AFTER UPDATE` on `goods_receipt_notes` when `status` transitions to `approved` or `completed`:

For each `grn_items` row (with quality_status in 'good','damaged' — exclude 'rejected'):
1. Insert a row into `warehouse_item_price_history`.
2. Update `warehouse_item_catalog.unit_cost = NEW unit_price` (master "last purchase price").
3. Update `warehouse_items.unit_cost` for the same `catalog_item_id` scoped to the GRN's `company_id` (per-company last cost).

Idempotent: skip if a price-history row for `(grn_item_id)` already exists, so re-approvals don't double-insert.

Standards note: this matches SAP MM moving "Last PO Price" semantics; valuation/FIFO layers in `cost_layers` remain untouched — we only refresh the master "last price" pointer, never rewrite historical valuation.

### 3. UI — Price history in item details
`src/components/warehouse/ItemDetailsDialog.tsx` (or the catalog item details panel) gains a new "Purchase Price History" section:
- New hook `useItemPriceHistory(catalogItemId)` reads from `warehouse_item_price_history` ordered by `received_at DESC`, limited to 50 with "View more".
- Table columns: GRN Date · GRN # · Supplier · Qty · Unit Price · Total · PO #.
- Header strip shows: **Last Price** (most recent), **Avg (last 12 mo)**, **Min / Max (last 12 mo)** — standard procurement KPIs.
- Empty state: "No purchase history yet."

### 4. Backfill
One-time backfill insert into `warehouse_item_price_history` from existing `grn_items` joined to `goods_receipt_notes` where status in ('approved','completed'), then refresh `unit_cost` on catalog + per-company items from the latest row per item.

## Technical details

- All schema work in one migration; data backfill via the insert tool after migration approval.
- Trigger uses `SECURITY DEFINER` + `SET search_path = public`.
- No client-side cost recalc — DB is source of truth (matches `stock-ledger-immutable-balances` memory rule).
- Realtime: add `warehouse_item_price_history` to publication so open item dialogs refresh after new GRN approvals.

## Out of scope
- Moving average cost / weighted-avg revaluation (separate effort; would touch `cost_layers` and journal entries).
- Currency conversion for multi-currency GRNs (use raw GRN currency for now; flagged for follow-up).
