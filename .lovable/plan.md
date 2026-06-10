## Add items by bin (MIN bulk staging)

Add a fourth entry method to `BulkAddItemsPanel` alongside *Add row / Paste codes / Browse inventory*: **Add by bin**. The user picks a bin at the issue location, sees every item currently allocated to it, and adds them all to the staging grid in one click. Quantity per row is auto-populated from the bin allocation (the user can still tweak it in the grid before committing to the MIN).

### UX
- New button **"Add by bin"** (icon: `Boxes`) in the panel toolbar, disabled until an Issue Location is chosen — same gating as the other actions.
- Opens a new dialog `AddByBinDialog`:
  - Bin selector limited to bins at the selected `locationId` (uses existing `useBinsAtLocation` RPC).
  - On bin select, fetch all `warehouse_bin_allocations` for that bin with `quantity > 0`, scoped to the current company, joined to `warehouse_items → warehouse_item_catalog` for `item_code`, `name`, `unit_of_measure`, and to `warehouse_bins` for `bin_code`.
  - Preview table: Item · Code · UoM · Bin qty (read-only). Footer shows count + "Add N items".
  - Skip items already staged (`existingItemIds` + current rows) — show them greyed with an "already added" badge, do not re-add.
  - Empty state when bin has no stock.
- Confirm calls `onResolved(picked)` with `BrowsePickedRow[]`, where `quantity = bin allocation qty` and `current_stock = item.current_stock` (so the existing per-row validation in the grid keeps working). `BulkAddItemsPanel.mergePicked` already handles merge-by-id and qty summing, so nothing changes there.

### Why qty = bin allocation qty (not 0)
The request says "Qty to issue should be ignored" — interpreted as *don't make the user enter it*. Pre-filling with the bin's available qty matches how "Browse inventory" already behaves and is the most useful default for "issue everything in this bin". The user can still edit or zero out individual rows in the staging grid before clicking *Add to MIN*.

### Files

**New**
- `src/components/warehouse/material-issue/AddByBinDialog.tsx`
  - Props: `open`, `onOpenChange`, `companyId`, `locationId`, `existingItemIds`, `onResolved(rows: BrowsePickedRow[])`.
  - Uses `useBinsAtLocation(locationId)` for the bin dropdown.
  - Inline `useQuery(['min-add-by-bin', binId, companyId])` on `warehouse_bin_allocations` filtered by `bin_id` + `company_id`, embedding item + catalog + bin code.
  - Maps allocations → `BrowsePickedRow` and emits via `onResolved`.

**Edited**
- `src/components/warehouse/material-issue/BulkAddItemsPanel.tsx`
  - Add `binAddOpen` state, `Boxes` import, new toolbar button, and render `<AddByBinDialog … onResolved={mergePicked} />`.

### Out of scope
- No backend / SQL / RLS changes — `warehouse_bin_allocations` is already readable with the embeds used elsewhere in the project.
- No changes to the MIN submit flow, validations, or the existing three entry methods.
- No new permission gates — same access as the rest of the MIN dialog.
