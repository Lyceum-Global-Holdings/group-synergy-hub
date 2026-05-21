## Problem

The **Stock on Hand** report (`WH-STK-OH-001`) shows one row per item using the item-level `warehouse_items.current_stock` field. It never joins the bin tables, so when a location holds stock across multiple bins:
- Only an aggregated item-level number is shown
- Bin codes are invisible
- You cannot tell which bin holds what
- There is no way to filter by a specific bin

This violates the project's location-scoped stock model (stock lives in `warehouse_bin_allocations`, one row per `(company, item, location, bin)`).

## Goal

Show **all bins** linked to the selected location in the Stock on Hand report, and add two new filters:
1. **Bin-wise breakdown** toggle — one row per bin (instead of one row per item)
2. **Bin** picker — restrict output to a single bin

## Changes

### 1. Database — `report_stock_on_hand` RPC (migration)

Extend the function signature with two new params and re-implement the body so it sources stock from `warehouse_bin_allocations`:

```
report_stock_on_hand(
  p_company_id    uuid,
  p_location_id   uuid default null,
  p_category_id   uuid default null,
  p_include_zero  boolean default false,
  p_bin_id        uuid default null,   -- NEW
  p_bin_wise      boolean default false -- NEW
)
```

Returned columns gain `bin_id`, `bin_code`, `bin_name`, `bin_location_id`, `bin_location_name` (always populated when `p_bin_wise=true`; null otherwise so existing callers keep working).

Logic:
- Join `warehouse_items_full wi` → `warehouse_bin_allocations wba` (on `wba.warehouse_item_id = wi.id AND wba.company_id = p_company_id`) → `warehouse_bins wb` → `warehouse_locations wl_bin`.
- Location filter applies to **either** `wi.location_id` (item's home location) **or** `wb.location_id` (bin's actual location) so every bin physically attached to the selected node is included — fixes the "missing bins" issue.
- `p_bin_id` filters on `wb.id`.
- `p_include_zero=false` filters `wba.allocated_quantity > 0`.
- When `p_bin_wise=true`: one row per `(item, bin)`, `current_stock = wba.allocated_quantity`, `reserved_quantity = wba.reserved_quantity`, `available_quantity = allocated - reserved`, `stock_value = allocated * wi.unit_cost`.
- When `p_bin_wise=false`: one row per `(item, location)` aggregated via `SUM` over the same join, preserving existing report shape.

Index already exists on `warehouse_bin_allocations(warehouse_item_id)` per project memory; no new indexes needed.

### 2. Registry — `src/lib/reports/registry.ts`

Add a new parameter type and extend the Stock on Hand definition:

- New `ReportParameter` variant `{ type: "bin"; key; label; dependsOn: "locationId" }` (lists bins at the picked location; disabled until a location is chosen; defaults to "All bins").
- Add two parameters to `WH-STK-OH-001`:
  - `{ key: "binWise", label: "Show bin-wise breakdown", type: "boolean", defaultValue: false }`
  - `{ key: "binId", label: "Bin", type: "bin", dependsOn: "locationId" }`
- Add two new columns (rendered only when `binWise=true`, but always defined so XLSX/PDF/CSV behave consistently):
  - `bin_code` ("Bin Code")
  - `bin_name` ("Bin Name")

### 3. Parameter renderer — `src/components/management/reports/ReportParameterPanel.tsx`

Add a `case "bin"` branch:
- Reads sibling `locationId` from `values` to scope the bin list.
- Uses existing `useBinsAtLocation(locationId)` hook (already in the codebase, returns bins physically attached to the exact node — matches SAP EWM discipline).
- Renders a `<Select>` with "All bins" + each `bin_code` (and `name` when present).
- Disabled with helper text when no location is chosen.
- When the user changes `locationId`, clear any stale `binId` value.

### 4. Data hook — `src/hooks/reports/useReportData.ts`

Update `fetchStockOnHand` to accept and forward the new params:

```ts
params: {
  locationId?: string | null;
  categoryId?: string | null;
  includeZero?: boolean;
  binId?: string | null;     // NEW
  binWise?: boolean;         // NEW
}
```

Pass `p_bin_id` and `p_bin_wise` to the RPC. Totals (`sumCol`) keep working unchanged because the column names match.

## Out of scope

- Other reports (movement ledger, valuation, aging, ABC) are untouched.
- No UI changes outside the Reports parameter panel and registry.
- No changes to the bin master, allocation logic, or realtime hooks.

## Verification

1. From `/warehouse/inventory` → "Stock on Hand" report:
   - Pick a location that has 2+ bins for the same item → preview shows aggregated single row (default).
   - Toggle **Show bin-wise breakdown** → preview now lists one row per bin with `Bin Code` / `Bin Name` columns populated.
   - Pick a specific **Bin** → preview narrows to that bin only.
   - Export XLSX/PDF/CSV → bin columns appear when bin-wise is on.
2. Confirm legacy callers (anything still passing only the original 4 args) keep returning the same aggregated rows — new params default to `null` / `false`.
