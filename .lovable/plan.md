# Fix: "Insufficient Batch Stock" when on-hand exists

## Root cause (verified in DB)

The three items in the screenshot are flagged `is_batch_tracked = true`, and the bin allocations hold the full quantity — but `item_batches` is missing (or short of) matching lots:

| Item | Bin qty | Active batch qty |
|---|---|---|
| INV-PNT-000-0078 (Horizon) | 50 | **0** |
| INV-PNT-000-0083 (Mellow) | 15 | **4** |
| INV-PNT-000-0085 (Moorland) | 10 | **0** |

The MIN FIFO preview only allocates from `item_batches`, so even though the bin shows stock, it reports "0 batches" / "Insufficient Batch Stock". This happens whenever stock enters a batch-tracked item without a lot — opening stock, bulk stock upload, manual bin adjustments, or items that were toggled to batch-tracked *after* receiving stock. Per GS1 AI(10), every batch-tracked unit must carry a lot — so the right fix is to make sure one always exists.

## Plan

### 1. Backfill — one migration

For every batch-tracked `warehouse_items` row where `SUM(bin_allocations.allocated_quantity) > SUM(active item_batches.quantity_remaining)`:

- Create a synthetic opening lot per (company, item, location, bin):
  - `batch_number = OPEN-{item_code}-{YYYYMMDD}-{NNNN}` (GS1-safe, ≤20 chars, `[A-Z0-9./-]`).
  - `quantity_received = quantity_remaining = (bin_qty − already_batched_qty)`.
  - `unit_cost = warehouse_item_catalog.unit_cost` (master), `status = 'active'`, `notes = 'Auto-created opening lot — pre-existing stock reconciliation'`.
  - `grn_item_id = NULL`, `manufacturing_date = NULL`, `expiry_date = NULL`.
- Insert matching `batch_stock_allocations` rows tying the new lot to the existing `warehouse_bin_allocations` so FIFO and the bin views agree.
- Wrap in a single transaction; idempotent (guarded by the delta check).

### 2. Prevent recurrence — same migration

Add a trigger `ensure_opening_batch_on_allocation` on `warehouse_bin_allocations` (AFTER INSERT/UPDATE) that, when the item is batch-tracked and the bin's allocated qty exceeds the sum of its `batch_stock_allocations`, auto-creates a `OPEN-…` lot for the delta. Same logic also fires when `warehouse_items.is_batch_tracked` is flipped from `false` → `true` and existing stock has no lots.

Bulk stock upload, opening-stock entry, and manual bin adjustments all funnel through `warehouse_bin_allocations`, so this single trigger closes every entry path without changing each caller.

### 3. UI — small clarity tweak

In `ConvertToIssueDialog` FIFO preview, when an item has bin stock but zero batch coverage, change the banner from "Insufficient Batch Stock" to "No batch assigned — open a lot in Batch Management" and link to `/warehouse/batches?item={id}`. Purely informational; not needed once the trigger is live, but useful while the backfill runs and for any future edge case.

## Technical details

- **New migration** `…_auto_opening_batches_for_unbatched_stock.sql`:
  - Backfill CTE: `delta = bin_alloc − active_batch_alloc` per (company, warehouse_item, location, bin).
  - `generate_batch_number(company_id, warehouse_item_id)` is reused for the lot number (existing RPC).
  - Trigger function `public.ensure_opening_batch_on_allocation()` — SECURITY DEFINER, `SET search_path = public`.
- **No schema changes** to `item_batches` / `warehouse_bin_allocations`.
- **No RLS changes**; the trigger runs in DB context.
- **Frontend**: only `src/components/warehouse/ConvertToIssueDialog.tsx` (banner text + link).

## Out of scope

- Cost layer rework (FIFO costing already reads `unit_cost` from the lot — opening lots use the catalog master price set in the recent unit-cost work).
- Switching valuation method, manual lot edits, or expiry assignment for legacy stock (lots created here have NULL expiry/mfg — user can edit in Batch Management).
- GRN trigger — already creates lots correctly; untouched.
