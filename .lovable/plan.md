## Goal

Align the system with international WMS standards (SAP EWM / Oracle WMS / IFS):
- A **Storage Bin** belongs to exactly one **Storage Location**.
- An item's effective storage location is derived from the bins where its stock physically sits.
- When a bin is (re)assigned to a Location, every item currently allocated to that bin must immediately appear under that Location — no manual re-assignment.

Today this is broken in three places:
1. `warehouse_items.location_id` is a free-floating column. It is set manually (`AssignLocationDialog`, bulk import) and gets stale when bins move or new allocations are created.
2. When a user creates a bin allocation in a bin that lives in Location B, but the item still has `location_id = A`, dashboards/reports/inventory filters show the item under A.
3. If an admin re-parents a bin (changes `warehouse_bins.location_id`), the items inside that bin do not follow.

## What we'll change

### 1. Database — make bin the source of truth (migration)

Add two `SECURITY DEFINER` triggers (idempotent, set `search_path = public`):

**a. `tg_sync_item_location_from_allocation`** on `warehouse_bin_allocations` (AFTER INSERT OR UPDATE OF bin_id, allocated_quantity):
- For the affected `warehouse_item_id`, recompute the "primary location" = the bin's location with the largest active `available_quantity`.
- If the item currently has no `location_id`, OR the current `location_id` no longer holds any active allocation for the item, update `warehouse_items.location_id` to that primary location.
- Skip if `available_quantity = 0` and no other active allocations exist (item has no physical presence; leave location untouched).

**b. `tg_sync_items_when_bin_relocated`** on `warehouse_bins` (AFTER UPDATE OF location_id):
- When a bin's `location_id` changes, find every `warehouse_item_id` with active allocations in that bin.
- For each such item, re-run the same "primary location" recomputation as above so items follow the bin to its new home.

Both triggers operate row-by-row using small set-based queries; no recursion guard needed because they only touch `warehouse_items.location_id`, never `warehouse_bin_allocations` or `warehouse_bins`.

**c. One-time backfill** (in same migration):
```sql
UPDATE warehouse_items wi
SET location_id = sub.location_id
FROM (
  SELECT a.warehouse_item_id, b.location_id
  FROM warehouse_bin_allocations a
  JOIN warehouse_bins b ON b.id = a.bin_id
  WHERE a.available_quantity > 0 AND b.location_id IS NOT NULL
  ORDER BY a.warehouse_item_id, a.available_quantity DESC
) sub
WHERE wi.id = sub.warehouse_item_id
  AND (wi.location_id IS DISTINCT FROM sub.location_id);
```
(Implemented with `DISTINCT ON (warehouse_item_id)` so each item gets its dominant bin's location.)

### 2. UI — surface the derived location

- **`BinAllocationsTab`**: include the bin's parent location name in the table (`bin.warehouse_location.name`) so users can see at a glance where each allocation lives. Add a Location filter.
- **`CreateBinAllocationDialog`**: show the bin's location next to the bin code in the dropdown (`A-01-01 — Aisle A · LNQ-Aluminium`) so a user cannot accidentally allocate into a bin from the wrong site.
- **`ItemMasterTab`**: keep the existing per-location stock breakdown (already correct), but stop relying on stale `warehouse_items.location_id` for the displayed "primary location" — read it from the freshly-synced column instead. No new query needed; the trigger keeps it accurate.
- **`AssignLocationDialog`**: keep manual override path for items with zero allocations, but display a hint that "Location is normally inherited from the bin allocation".

### 3. Cache invalidation

The mutations in `useWarehouseBinAllocations` and `useWarehouseBins` already invalidate `['warehouse-items']` and `['all-items-location-stock']`, so once the trigger fires the next refetch shows the corrected location. No client wiring change needed beyond adding `['warehouse-bins']` invalidation when a bin is updated (already present in `useWarehouseBins`).

## Files to touch

- `supabase/migrations/<new>.sql` — triggers + backfill
- `src/components/warehouse/BinAllocationsTab.tsx` — show location column + filter
- `src/components/warehouse/CreateBinAllocationDialog.tsx` — show location in bin picker
- `src/hooks/useWarehouseBinAllocations.ts` — include `warehouse_bin.warehouse_location(name)` in the select
- `src/components/warehouse/AssignLocationDialog.tsx` — informational hint only

## Out of scope

- No change to `stock_transactions` scoping (already per-location per memory).
- No change to RLS / company isolation.
- No change to the `current_stock` reconciliation engine — it continues to operate per `(company, item, location, bin)`.
