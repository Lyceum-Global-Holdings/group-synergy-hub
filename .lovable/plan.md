## Goal

Add a new Reports Center report that answers: *"How much of item X is sitting anywhere in the group?"* — a single-item, cross-company, cross-location, cross-bin stock availability snapshot.

International-standards alignment:
- **IAS 2** (Inventories) — on-hand quantity × weighted-average unit cost = stock value
- **SAP EWM / WMS hierarchy** — Company → Warehouse → Sub-location → Bin → (Batch optional)
- **GS1 CBV** — uses our existing `warehouse_item_catalog` global item identity (one catalog row per item, mirrored per company)
- Respects multi-tenant access via `can_access_company` so each user only sees rows for companies they're entitled to.

## New report

**Code:** `WH-ITEM-AVAIL-001`
**Title:** *Item Stock Availability (Group-wide)*
**Group:** Warehouse → Inventory
**Standard label:** "IAS 2 / SAP EWM hierarchy"

### Parameters
| Key | Type | Notes |
|---|---|---|
| `catalogItemId` | **item** (new picker type) | Required. Searchable combobox over `warehouse_item_catalog` (code + name + brand). |
| `locationId` | location | Optional — filter to one warehouse/sub-location. |
| `binId` | bin | Optional, depends on `locationId`. |
| `groupBy` | select | `bin` (default), `location`, `company`. Controls aggregation level. |
| `includeZero` | boolean | Default false. |
| `includeBatches` | boolean | Default false — if true, breaks rows by batch number. |

### Columns (rendered in this order)
`company_name, location_path (Warehouse › Sub-location), bin_code, bin_name, batch_number (when includeBatches), unit_name, on_hand_qty, reserved_qty, available_qty, unit_cost, stock_value, status`

Totals row sums `on_hand_qty`, `reserved_qty`, `available_qty`, `stock_value` across all visible companies.

## Backend

New SECURITY INVOKER RPC `report_item_stock_availability(p_catalog_item_id uuid, p_location_id uuid, p_bin_id uuid, p_group_by text, p_include_zero bool, p_include_batches bool)`:

- Resolves all `warehouse_items` rows that share the catalog id, across every company the caller `can_access_company`.
- Joins `bin_allocations` (or location allocations for bins.is_shared) → `warehouse_bins` → `warehouse_locations` (recursive CTE to build `Warehouse › Sub-location` path).
- Joins `warehouse_item_batches` only when `p_include_batches`.
- Reads master fields from `warehouse_items_full` (per memory rule).
- Returns flat rows ordered by `company_name, location_path, bin_code, batch_number`.
- Filters before LIMIT (per `list-rpc-filter-before-paginate` memory).

Migration only adds the function (no schema change) so the standard RLS lockdown still applies.

## Frontend

1. **`src/lib/reports/registry.ts`** — Add the new `WH-ITEM-AVAIL-001` definition. Add new parameter discriminator `{ type: "item" }` to `ReportParameter`.
2. **`src/components/management/reports/ReportParameterPanel.tsx`** — Add an `case "item"` branch rendering a searchable combobox backed by `warehouse_item_catalog` (debounced ilike on `item_code` / `name`, 25-row page). Reuse the existing combobox primitive used for category/supplier pickers.
3. **`src/hooks/reports/useReportData.ts`** — Add `fetchItemStockAvailability` calling the new RPC and wire `case "warehouse.itemStockAvailability"` in the switch. Totals = sum of qty + value columns.
4. **No** changes to xlsx / pdf / csv renderers — they're column-driven.

## Out of scope

- No edits to existing reports.
- No UI changes outside Reports Center.
- No new pages or routes.

## Technical notes

- Group-wide visibility relies on `can_access_company(uid, company_id)` already used elsewhere; no new RLS policy required because the RPC is `SECURITY INVOKER`.
- The item picker queries `warehouse_item_catalog` directly (global table, already readable to authenticated users per existing catalog RLS).
- `location_path` is computed in SQL with a `WITH RECURSIVE` CTE walking `warehouse_locations.parent_id`, capped at the 2-level hierarchy enforced by memory `warehouse-location-hierarchy`.
- For `groupBy = location` or `company`, the SQL collapses bin/batch rows with `SUM()` and nulls the lower-level columns so the same column set works for every aggregation level.