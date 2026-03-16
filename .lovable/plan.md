

# Column Visibility Toggle & Compact Rows for Item Master & Inventory

## What This Does
Adds a column visibility dropdown to both the Item Master Definition and Inventory tabs, letting users show/hide columns to see item names fully. Also reduces row spacing for a denser, more scannable table.

## Changes

### 1. Column Visibility Dropdown (both tabs)

Add a `Columns` dropdown button (using existing `DropdownMenu`) in each tab's toolbar area. Each column gets a checkbox toggle. State stored via `useState<Record<string, boolean>>` with all columns visible by default.

**Item Master Definition columns** (14 total): Photo, Item Code, Name, Category, Unit, Brand, Supplier, Barcode/SKU, Unit Cost, Selling Price, Reorder Lvl, Current Stock, Status, Actions.
- Name and Actions always visible (non-toggleable).

**Inventory columns** (13 total): Photo, Item Code, Name, Category, Unit, Brand, Supplier, Bin, Company, Current Stock, Unit Cost, Status, Actions.
- Name and Actions always visible.

Each `<TableHead>` and corresponding `<TableCell>` wrapped with `{visibleColumns.columnKey && ...}`.

### 2. Remove Name Truncation

- **Item Master Definition**: Remove `max-w-[180px] truncate` from the Name cell (line 318) so item names display fully.
- **Inventory**: Name cell already wraps — no truncation to remove.

### 3. Reduce Row Spacing

- Add `className="[&_td]:py-1.5 [&_th]:py-1.5"` to both `<Table>` elements to reduce vertical padding from the default ~12px to 6px.
- Reduce photo thumbnail size from `h-10 w-10` to `h-8 w-8` in Inventory tab to match Item Master Definition.

### Files to Modify
- `src/components/warehouse/ItemMasterDefinitionTab.tsx` — add column visibility state + dropdown + conditional rendering + compact rows
- `src/components/warehouse/ItemMasterTab.tsx` — same pattern

