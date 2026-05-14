## Goal

Add **dual-quantity tracking** to inventory so users can receive stock as "X pieces × Y length" (or any secondary unit), while the system keeps a single canonical base-quantity ledger for valuation and FIFO.

Each receipt captures its own conversion — no fixed factor on the item master — so variable cut sizes (e.g. 200 m delivered as 18 pieces of varying length) are preserved.

---

## Schema changes

### `warehouse_items`
- `base_uom text` — canonical unit (e.g. `m`, `kg`, `L`). Defaults to existing `unit_of_measure`.
- `secondary_uom text NULL` — counted unit (e.g. `pcs`, `roll`, `bag`). Optional.
- `track_secondary_quantity boolean default false` — opt-in flag per item.

`current_stock` and all valuation logic remain in **base UOM** (no breaking change).

### `warehouse_bin_allocations`
- `secondary_quantity numeric NULL` — running pieces in this bin.

### `stock_transactions`
- `secondary_quantity_change numeric NULL`
- `secondary_quantity_before numeric NULL`
- `secondary_quantity_after numeric NULL`
- `secondary_uom text NULL` (snapshot)

Trigger `set_stock_transaction_balances` extended to also compute `secondary_quantity_before/after` from `warehouse_bin_allocations.secondary_quantity` when the item has `track_secondary_quantity = true`. Same authoritative pattern as base quantity.

### `grn_items`
- `secondary_quantity_received numeric NULL`
- `secondary_uom text NULL`
- `conversion_note text NULL` — free text e.g. "18 pcs averaging 11.1 m"

### `warehouse_batches` (if used for FIFO)
- `secondary_quantity_remaining numeric NULL`
- `secondary_uom text NULL`

### Backfill
- Set `base_uom = unit_of_measure` for all existing rows.
- Leave `secondary_*` NULL — items behave exactly as today until enabled.

---

## RPC / function updates

- `set_stock_transaction_balances` trigger — also reads/writes secondary qty when present.
- Bin allocation upsert helpers (`adjust_bin_allocation_from_scan`, GRN allocation, issue, transfer) — accept and apply `secondary_quantity_delta` alongside base delta.
- `list_warehouse_inventory` RPC — return `secondary_quantity` and `secondary_uom` columns.
- `get_bin_scoped_stock_movements` — return secondary balances verbatim.

No change to FIFO ordering — base UOM continues to drive valuation and consumption.

---

## UI changes

### Item master (`CreateItemDialog`, `EditItem...`)
- New section "Dual quantity tracking" (collapsed by default).
  - Toggle: *Track pieces separately from base unit*
  - When on: `Base UOM` (locked to existing UOM), `Secondary UOM` (e.g. pcs).

### GRN entry (`CreateGrnDialog`, `GrnBinAllocationDialog`)
For items with `track_secondary_quantity`:
- Two inputs side-by-side:
  - **Pieces** (`secondary_quantity_received`)
  - **Total length / weight** (`quantity_received`, base UOM)
- Optional note "avg per piece" auto-computed for display only.

### Material Issue / Transfer / Adjustment
- Same dual input pattern. User can enter either pieces or base qty; the other can be left blank when not tracked at issue time (e.g. issuing 5 m off a coil — pieces unchanged).
- Validation: at least one of (base, secondary) must be provided; if both, both apply.

### Inventory list / Item details / Bin allocation views
- Show "120 m (8 pcs)" formatted via `formatQty` helper extended to render dual values.
- Stock movements ledger — extra columns for secondary before/change/after, hidden when item doesn't track it.

### Bin QR adjust screen (`/b/:id`)
- Same dual input when scanned bin's item tracks secondary.

---

## Files to add / change

**New**
- `src/lib/dualQuantity.ts` — formatter, parser, validation helpers.
- `src/components/warehouse/DualQuantityInput.tsx` — reusable input pair.

**Edit (high-level)**
- `src/components/warehouse/CreateItemDialog.tsx`, `ItemMasterTab.tsx`
- `src/components/warehouse/CreateGrnDialog.tsx`, `GrnBinAllocationDialog.tsx`, `GrnDetailsDialog.tsx`
- `src/components/warehouse/CreateMaterialIssueDialog.tsx`, `IssueItemsDialog.tsx`
- `src/components/warehouse/CreateStockTransferDialog.tsx`
- `src/components/warehouse/BulkAdjustmentDialog.tsx`
- `src/pages/warehouse/Inventory.tsx`, `BinAllocations.tsx`, `MaterialIssueReturn.tsx`
- `src/pages/PublicBinAllocation.tsx` (scanned adjust)
- `src/types/warehouse.ts`, `src/types/stockTransaction.ts`, `src/types/grn.ts`
- Memory note: add `mem://architecture/dual-quantity-tracking`

---

## Rollout

1. Migration (schema + trigger update + backfill `base_uom`). Existing items unchanged.
2. Ship UI behind item-level `track_secondary_quantity` toggle — opt in per item, no forced migration of existing stock.
3. Optional follow-up: bulk-enable tracking for a category and seed `secondary_quantity` from physical count.

---

## Out of scope

- Variable per-piece dimensions (length-per-piece records). If you later need to know "piece #3 was 12.4 m", that's a separate `warehouse_item_serials`-style table. The current plan stores totals per receipt/bin only.
- Changing valuation to piece-based — base UOM stays the money unit.