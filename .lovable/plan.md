## Bulk Add Items to Material Issue Note

Add a "Bulk add items" panel above the existing single-item "Add Item" form on the Items step of `CreateMaterialIssueDialog`. It exposes three complementary entry modes that all feed the same in-grid staging table, then commit selected rows to the MIN items list in one click.

### UI layout (Items tab)

```text
┌─ Bulk add items ─────────────────────────────────────────────┐
│ [+ Add row]  [Paste codes]  [Browse inventory]   [Clear all] │
│                                                              │
│  ☐  Item (picker)        Code      Avail   UoM   Qty   Note │
│  ☐  10mm cap Black …     INV-…-066  183    Nos   [  ]  [ ]  │
│  ☐  …                                                        │
│                                                              │
│  3 rows · 2 valid · 1 issue            [Add 2 rows to MIN]   │
└──────────────────────────────────────────────────────────────┘

— Add Item (existing single-item form stays below) —
```

### Three entry modes (all feed the same grid)

1. **Add row (manual)** — inserts an empty row. The Item cell uses the existing `ItemSelector` filtered to `formData.location_id`. On select, the row auto-fills code, UoM, available qty.
2. **Paste codes dialog** — textarea accepting `item_code` or `item_code,qty` (one per line; TSV from Excel also supported). On Resolve, calls `list_warehouse_inventory` RPC with `_search` + location filter, batched by code, marks each line as resolved/duplicate/not-found/out-of-stock, and appends resolved rows to the grid (preserving any typed qty).
3. **Browse inventory dialog** — reuse the existing `BrowseInventoryDialog` (already wired). Confirming it pushes ticked rows into the grid instead of straight into the MIN, so users can still tweak qty/notes before final commit.

### Grid behaviour

- Columns: select checkbox, Item name, Code (badge), Available, UoM, Qty to issue (number input, default 0), Purpose (optional, short text), row-delete.
- Inline validation per row: qty > 0 and qty ≤ available stock; duplicate item_id flagged.
- Footer summary: total rows, valid rows, issues; primary button `Add N rows to MIN` is disabled until ≥1 valid row.
- "Add to MIN" calls the existing `handleAddItem`-equivalent path for each valid row (so reservation linking, dual-quantity, secondary qty, and the existing MIN totals all keep working), then clears the grid.
- Rows already present in `formData.items` are flagged "already in MIN" and excluded from commit by default.

### Files to touch

- New: `src/components/warehouse/material-issue/BulkAddItemsPanel.tsx` — grid + toolbar, owns local rows state, exposes `onCommit(rows)`.
- New: `src/components/warehouse/material-issue/PasteCodesDialog.tsx` — textarea + resolver using `list_warehouse_inventory` RPC scoped to `companyId` + `locationId`, returns resolved rows.
- Edit: `src/components/warehouse/CreateMaterialIssueDialog.tsx`
  - Render `<BulkAddItemsPanel>` at the top of the Items tab, gated on `formData.location_id`.
  - `onCommit` maps each grid row into the same shape `handleAddItem` builds today and appends to `formData.items` (one helper function shared with the existing single-item Add).
  - Reuse existing `BrowseInventoryDialog`; just change its `onConfirm` (when invoked from the bulk panel) to push into the grid instead of directly into `formData.items`.

No DB schema changes, no new RPCs — `list_warehouse_inventory` already supports search + location scoping and is what the Browse dialog uses.

### Out of scope

- Reserved-item bulk add (already covered by the "Add All Reserved Items" button).
- Excel/CSV file upload — paste-from-spreadsheet via TSV covers the common case; we can add file upload later if needed.
