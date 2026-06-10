# One-Click Add from Available Inventory

## Problem
Today the Items step of Create MIN forces the user to add stock one row at a time: search → pick → type qty → click Add → repeat. For MINs with many lines this is slow and error-prone, and the user can't see what stock is actually available at the issuing location.

## Solution
Add a second entry path on the Items step: **"Browse Available Inventory"** — a table view of everything in stock at the selected issue location, with multi-select, inline quantity editing, and a single "Add Selected to MIN" action. The existing single-item picker stays for power users who already know the code.

## UX

Items step gets a new button row above the current "Add Item" card:

```text
[ + Add Item (single) ]   [ 🗂  Browse Available Inventory ]
```

Clicking **Browse Available Inventory** opens a large dialog:

```text
┌─ Available Inventory @ {Issue Location}  ─────────────── x ┐
│  [ 🔍 Search code / name / category ]   [Category ▾]       │
│  ☐ Show only items with stock > 0   (default ON)            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ☐ │ Code   │ Name           │ UoM │ Avail │ Bin │ Qty  │ │
│ │ ☑ │ STL-01 │ Steel Rod 12mm │ KG  │ 1,250 │ A-1 │ [100]│ │
│ │ ☑ │ CEM-04 │ Cement OPC     │ BAG │   480 │ B-2 │ [ 50]│ │
│ │ ☐ │ ...    │                │     │       │     │      │ │
│ └────────────────────────────────────────────────────────┘ │
│  Showing 50 of 1,284 · [Load more]                          │
│                                                             │
│  3 items selected · total 230 units                         │
│                  [ Cancel ]   [ + Add 3 Selected to MIN ]   │
└─────────────────────────────────────────────────────────────┘
```

Behavior:
- Disabled with a hint until the user picks an **Issue Location** on the Header step (stock is location-scoped).
- Server-side search via existing `list_warehouse_inventory` RPC (`_location_ids: [locationId]`, `_stock_mode: 'in_stock'`, `_search`, `_limit: 50`, keyset pagination). No 14k-row full-fetch.
- Debounced search (250 ms).
- Checkbox per row; selecting a row auto-fills `Qty` with `min(available, 1)` and focuses it; user can edit.
- Header checkbox = select all on current page.
- "Add Selected" closes the dialog and appends each selected row to the MIN's `items[]` using the same shape `addItem` produces today (item_id, code, description, UoM, qty, available_stock, dual-qty flags). Duplicates against existing MIN lines are merged (qty summed) with a toast.
- Validation: qty must be `> 0` and `≤ available`; invalid rows are highlighted and block submit.
- Selection state survives pagination/search within the dialog session.

## Technical Notes

- **New file:** `src/components/warehouse/BrowseInventoryDialog.tsx`
  - Props: `open`, `onOpenChange`, `locationId`, `companyId`, `existingItemIds: string[]`, `onConfirm(rows: PickedRow[]) => void`.
  - Uses `useInfiniteQuery` on `list_warehouse_inventory` RPC keyed by `[company, location, search]`.
  - Table built from shadcn `Table` + `Checkbox` + `Input` (matches existing visual language; no new deps).
  - Internal `selected: Map<item_id, { qty: number, row: RpcRow }>` for stable selection across pages.
- **Edit:** `src/components/warehouse/CreateMaterialIssueDialog.tsx`
  - Add `browseOpen` state and the new button next to the existing Add Item card header.
  - Add `handleBulkAddFromBrowse(rows)` that maps RPC rows to `IssueItem` (mirroring `handleItemSelect` + `addItem`, including `track_secondary_quantity` / `secondary_uom` from `warehouse_items_full` fields already returned by the RPC), merges duplicates by `item_id`, and calls `setItems`.
  - Disable the Browse button when `formData.location_id` is empty; show tooltip "Select Issue Location first".
- No DB migration. No changes to `useMaterialIssueItems` (submission path unchanged — bulk-added rows go through the same `process_material_issue_stock_update` flow).
- No changes to the existing single-item `ItemSelector`; it remains available alongside.
- Memory rules respected: server-side paginated RPC (per `warehouse-inventory-server-pagination`), location-scoped reads (per `stock-transactions-location-scope`), no client-side full fetch.

## Out of Scope
- Saving picker presets / favorites.
- Editing already-added MIN lines from the browser (use the existing items table).
- Reservation-aware filtering (CPO reservation flow already has its own "Add all reserved" button and stays unchanged).
