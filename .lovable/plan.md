## Goal

Make Bulk Issue a first-class inventory action that:
1. Always shows the items the user picked from the inventory table.
2. Is launched from the page header next to **Bulk add from catalog** (not only from the selection bar).
3. Lets the user add/remove items inside the dialog before posting the MIN.

## Why the dialog currently shows "No items selected"

`BulkIssueFromInventoryDialog` seeds its `lines` only from the `selectedItems` array the parent passes in (`filteredItems.filter(i => selectedItemIds.has(i.id))`). When the dialog is opened from the page header (no selection), or when the inventory list has re-fetched/scrolled and a selected `id` is no longer in the currently materialized `filteredItems` page, the prop is empty and the table renders "No items selected." The fix is to (a) drive seeding from the persistent set of IDs and look the items up via a small RPC fallback, and (b) always offer an in-dialog picker so the user can add lines regardless of how the dialog was opened.

## Changes

### 1. `src/pages/warehouse/Inventory.tsx`
- Add a second header button **"Bulk Issue"** beside the existing **"Bulk add from catalog"** button (same row, secondary variant, `PackageCheck` icon).
- Local state `bulkIssueOpen`. Lazy-import `BulkIssueFromInventoryDialog` and render it with `selectedItems={[]}`, `defaultLocationId={globalLocationId}` (read via `useLocationFilter`).
- The dialog's own picker (below) lets the user pick items from scratch in this flow.

### 2. `src/components/warehouse/BulkIssueFromInventoryDialog.tsx`
- **Seeding fix**: when `open` flips to true, take the union of:
  - lines already in state (so re-opens don't wipe edits), and
  - any `selectedItems` passed in that aren't already represented.
  Map by `item_id` to dedupe. If a passed-in row is missing `current_stock`/`unit_of_measure`, look the value up later via the picker hook rather than dropping the row.
- **In-form "Add items" picker**: add an **"Add items"** button above the lines table that opens a lightweight search popover backed by the existing `useWarehouseItemsLazyInventory` hook (same RPC the inventory page already uses), scoped to `header.location_id` and `selectedCompany.id`. Selected rows are appended to `lines` with `available = current_stock`, `quantity = min(1, available)`. Duplicates are ignored.
- **Empty-state copy**: when `lines.length === 0`, replace "No items selected." with "No items yet — click **Add items** to start, or open this dialog from the inventory table with rows selected."
- Keep all existing validation, submit, and MIN-creation logic unchanged.

### 3. `src/components/warehouse/ItemMasterTab.tsx`
- No behavioural change to the floating selection bar (Bulk Issue button stays there for the table-driven flow). It already passes `selectedItems` correctly; the seeding fix in step 2 makes it resilient when virtualization drops a selected row out of `filteredItems`.

## Technical notes

- The picker reuses `useWarehouseItemsLazyInventory({ pageSize: 25, search, locationId, ... })` so no new RPC is needed and results respect the same RLS / location scope as the inventory page.
- Selection union is keyed on `item_id`; the picker calls `addLines(rows)` which filters out IDs already in `lines`.
- The page-header **Bulk Issue** button does not require any selection — it opens the dialog with an empty `lines` array and the user builds the MIN via the picker.
- No DB migration, no changes to `material_issue_notes` / `material_issue_items` write paths, no changes to `process_material_issue_stock_update`.

## Out of scope

- Re-styling the existing Material Issue page.
- Per-bin allocation UI (the existing post-create RPC continues to handle bin allocation).
- Approval workflow for bulk issues (still posts directly as `issued`, same as today).
