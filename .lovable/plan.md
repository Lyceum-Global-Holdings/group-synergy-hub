## Problem

In the **Stock on Hand** report, the Bin dropdown only lists bins **physically attached to the exact location node** picked above (Lyceum Fulfilment Centre). Bins that live under sub-locations / departments under that warehouse — where the item is actually allocated — don't appear, so users can't filter to them. It's also a single-select with no way to exclude bins.

(The two trailing entries in your screenshot — `LFC — Lyceum Fulfilment Center` and `NWS-STS — NWS Site Stores` — are stray bins whose `bin_code` was set to the location code; the real per-sub-location bins are missing entirely.)

## Solution

Treat the bin filter as a **multi-select over every allocated bin in the selected location's subtree**, with both **Include** and **Exclude** modes.

### 1. New RPC: `list_allocated_bins_in_subtree`

```text
list_allocated_bins_in_subtree(p_company_id uuid, p_location_id uuid, p_item_id uuid default null)
  -> id, bin_code, name, location_id, location_path, allocated_qty
```

- SECURITY INVOKER, STABLE.
- Recursive CTE down `warehouse_locations.parent_location_id` from `p_location_id` (or all company locations when null).
- Joins `warehouse_bin_allocations` filtered by `company_id` (and `warehouse_item_id` when `p_item_id` given) so we only return **bins that actually hold stock**, sorted naturally by `bin_code`.
- Returns `location_path` ("Warehouse › Aisle A › Rack 2") so the picker can show context for bins that share codes across sub-locations.

### 2. Report RPC: switch bin param to arrays

Replace `p_bin_id uuid` with two array params on `report_stock_on_hand`:

- `p_include_bin_ids uuid[] default null` — when non-empty, restricts to these bins.
- `p_exclude_bin_ids uuid[] default null` — when non-empty, removes these bins.
- Also widen the location predicate to match the subtree (recursive CTE), so `p_location_id = warehouse root` includes sub-location bins.

Old `p_bin_id` arg is kept as a deprecated alias (mapped into `p_include_bin_ids`) so existing dashboards/links keep working for one release.

### 3. UI: replace the Bin Select with `BinMultiFilterPopover`

A new component modeled on the existing `src/components/warehouse/bin-allocations/BinFilterPopover.tsx` (search, natural sort, select-all-filtered, clear) with two additions:

- **Mode toggle** at the top: `Include selected` / `Exclude selected`.
- Shows `location_path` under each `bin_code` so users can tell `1-B-7-2` in Aisle A from `1-B-7-2` in Aisle B.

Trigger label rules: `All bins` (none selected) · `1 bin: 1-B-7-2` · `3 bins included` · `2 bins excluded`.

### 4. Param wiring

- `src/lib/reports/types.ts`: add `binMulti` param shape `{ mode: 'include' | 'exclude'; binIds: string[] }`.
- `src/lib/reports/registry.ts` (WH-STK-OH-001): change `binId` → `binIds` with `type: "binMulti"`, still `dependsOn: "locationId"`.
- `src/components/management/reports/ReportParameterPanel.tsx`: render the new popover for `binMulti`; data source is the new RPC via a `useAllocatedBinsInSubtree(locationId)` hook (replacing `useBinsAtLocation` here only).
- `src/hooks/reports/useReportData.ts` → `fetchStockOnHand`: send `p_include_bin_ids` / `p_exclude_bin_ids` and drop the singular field.
- Filter chips in the report header summarise as `Bins: 3 included` / `Bins: 2 excluded` so PDF/XLSX exports record the choice.

### 5. Scope

Only `WH-STK-OH-001` changes behaviour. Other reports that use `useBinsAtLocation` (write paths — putaway, transfer destination) keep the exact-node hook untouched — those still need strict bin addressing per SAP EWM discipline.

### Technical notes

- Subtree CTE matches the pattern already used elsewhere (`warehouse_locations.parent_location_id`).
- Bin allocation read uses existing `(warehouse_item_id, company_id, bin_id)` index; subtree filter is a small `IN (...)` of location ids — no perf concern.
- Realtime invalidation already covers `warehouse-bin-allocations`; the new query key `['allocated-bins-subtree', locationId]` joins that bus.
- Grants: `GRANT EXECUTE ON FUNCTION public.list_allocated_bins_in_subtree(...) TO authenticated;` and same for the updated `report_stock_on_hand` signature.

### Out of scope

- Cleaning up the existing data anomaly where some bins have `bin_code` equal to a location code. Those will simply appear in the picker with their (correct) location path; a separate rename pass can fix the codes later if desired.
