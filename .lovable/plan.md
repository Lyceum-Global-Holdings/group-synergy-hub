# Fix wrong bin data in Stock Movement History

## What's actually wrong (verified in DB for INV-HAW-000-0389 @ Lyceum Anuradhapura)

The warehouse_item has two bin allocations: `LAN` (163, located at Anuradhapura) and `4-A-2-2` (20, located at **VEB** — a different warehouse_location). Three bugs combine to show wrong info:

1. **Bulk Stock Upload never writes `bin_id`** — `BulkStockUploadDialog.tsx` line 544–556 inserts the `stock_transactions` row with `notes: 'Bulk stock upload - Bin: 4-A-2-2'` but no `bin_id`. The single-bin auto-fill trigger can't help (item has 2 bins) and the notes-parser backfill found the bin but discarded it because the bin's `location_id` (VEB) doesn't match the transaction's `location_id` (Anuradhapura). Result: that movement currently has `bin_id = NULL` and never appears under any specific bin filter.

2. **Bin picker hides cross-location allocations** — `StockMovementDialog` filters bin options by `b.location_id === locationId`, so `4-A-2-2` (VEB) is hidden from the picker even though stock is physically allocated to this item there. Users can't choose it, and the default-first-bin logic silently picks `LAN`, which is misleading.

3. **No Bin column in the history table** — even when the data is right, users can't tell which bin a row belongs to.

Bin allocations being assigned to bins of a different `location_id` than the warehouse_item is a pre-existing data issue (separate from this fix), but our reader/writer must work correctly regardless: the source of truth for "which bins hold this SKU" is `warehouse_bin_allocations`, not `warehouse_bins.location_id`.

## Plan

### A. Writer fix — pass `bin_id` everywhere

- `src/components/warehouse/BulkStockUploadDialog.tsx`: include `bin_id: row.bin_id` in the `stock_transactions` insert (it's already resolved on the row).
- `src/components/warehouse/StockAdjustmentDialog.tsx` and `BulkAdjustmentDialog.tsx`: add a Bin selector (mandatory when item has >1 bin allocation) and pass `bin_id` into the insert.
- `src/components/warehouse/CreateItemDialog.tsx` / `SingleItemForm.tsx` opening-stock insert: pass the chosen bin.
- Transfer / Return paths (`ItemTransferDialog`, `CreateStockTransferDialog`, `ReturnStockFromSublocationDialog`, `CreatePutawayDialog`, MIR/MRN flows): pass `bin_id` per leg (source bin on `transfer_out`/`material_issue`, destination bin on `transfer_in`/`material_return`).
- Construction issue/return paths that mirror into `stock_transactions`: same.

### B. Reader fix — `StockMovementDialog`

- Drop the `b.location_id === locationId` filter on bin options. Source of truth is `warehouse_bin_allocations` for this `warehouse_item_id`. Show every allocated bin with a small "(at <bin location>)" suffix when the bin's location differs from the item's, so the user can see the data inconsistency.
- Add a **Bin** column to the table showing each transaction's bin code (resolved from `warehouse_bins`).
- When `binOptions.length > 1`, do not silently default to the first bin — default to **All bins (this location)** and show a warning chip "Showing movements across all bins. Pick a bin to isolate." This avoids the current behaviour of misleadingly showing only one bin's data without flagging that more exist.
- When `binOptions.length === 0`, hide the picker (legacy items with no allocation).

### C. Backfill rerun (DB migration)

The previous backfill discarded the `4-A-2-2` row because of the location mismatch. Re-run the backfill **without** the `b.location_id = p.location_id` constraint, but only when the bin code is unambiguous globally **or** uniquely allocated to that warehouse_item. Pseudocode:

```text
For each st row with bin_id IS NULL and notes ~ 'Bin: X':
  Try to resolve via warehouse_bin_allocations joined to warehouse_bins on bin_code = X
    where warehouse_item_id = st.item_id;
  If exactly one match → set bin_id.
  Else fall back to global unique bin_code match.
```

Also add a one-time backfill that uses `warehouse_bin_allocations` for any `stock_transactions` row whose item has only one allocation today (already done previously, no-op).

### D. Memory

Update `mem://architecture/stock-transactions-location-scope.md` to record:
- Bin options for the movement dialog come from `warehouse_bin_allocations`, never from `warehouse_bins.location_id`.
- Default scope when multiple bins exist is "All bins" with explicit warning, never silently first-bin.
- Every writer MUST pass `bin_id`.

## Out of scope

- Cleaning up bins whose `location_id` doesn't match the warehouse_item they're allocated to (data hygiene task — surfaced via the existing `v_stock_transactions_bin_mismatch` diagnostic view).
- Tool-management transactions (separate table).
