# Fix: Stock Details dialog showing all warehouses with 0

## Root cause

`ItemStockDetailsDialog` merges the per-item `locationStock` (resolved from bin → location, often returning **child** locations) with `allLocations`, which is fetched in `ItemMasterTab.tsx` (lines 202-214) restricted to **top-level locations only** (`.is('parent_id', null)`).

When stock lives in child locations (LAN, VEB, LNQ-Aluminium sub-bins, etc.), the join key never matches the top-level list, so every row renders `0` while "Total Stock" still reads `183` (totalled from the unmerged `locationStock` array). That is exactly what the screenshot shows for `INV-HAW-000-0389`.

## Fix (international WMS standard)

SAP EWM / Oracle WMS "Stock by Location" / "Stock Overview" panels list **only locations that physically hold stock** for the SKU, sorted by quantity descending, with % of total. Empty locations are not shown — they live in the separate Bin Master / Location Master view.

### `src/components/warehouse/ItemStockDetailsDialog.tsx`
- Drop the `allLocations` merge logic.
- Aggregate `locationStock` by `locationId` (defensive — handles duplicate rows from multiple bins per location).
- Filter to `stock > 0`.
- Sort by `stock DESC`, tie-break alphabetically.
- Compute `totalStock` from the aggregated list so the header and rows always reconcile.
- Empty-state copy: "No stock available in any location for this item."
- `allLocations` prop becomes unused — keep it optional for backward compatibility but stop relying on it.

### `src/components/warehouse/ItemMasterTab.tsx`
- No functional change required; the `allLocations` query can stay (used elsewhere) but is no longer needed by the dialog.

### Accessibility
- Add `DialogDescription` to `ItemStockDetailsDialog` to clear the radix `aria-describedby` warning currently in console.

## Outcome

For `INV-HAW-000-0389`, the dialog will list only LAN / VEB / LNQ (or whichever locations actually hold the 183 units), each with the correct quantity and % of total — matching the per-bin reconciliation already enforced server-side.
