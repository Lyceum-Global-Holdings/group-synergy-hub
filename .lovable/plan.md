## Goal
Show **sub-locations** (e.g. departments / stock-bearing child nodes) in the Issue Location selector of the Material Issue Note dialog, so materials can be issued from any storage node where stock physically lives.

## Root cause
`CreateMaterialIssueDialog` filters locations with `l.company_id === selectedCompany.id`. Sub-locations in this project intentionally have `company_id = NULL` and inherit access from their parent (49 of 59 sub-locations are like this). That client-side filter strips them all out — only top-level company-owned locations appear.

## Fix (SAP EWM / WMS standard)
Use the canonical server-side resolver `get_stock_bearing_locations_for_company` (already exposed via `useStockBearingLocationsForCompany`). It returns every node where the company has effective access — including inherited sub-locations and standalone sub-warehouses — which is exactly the set of valid Goods-Issue storage points.

## Technical changes

**File: `src/components/warehouse/CreateMaterialIssueDialog.tsx`**
- Import `useStockBearingLocationsForCompany` from `@/hooks/useWarehouseLocations`.
- Replace the `useWarehouseLocations()` + client-side `company_id` filter with:
  ```ts
  const { data: stockLocations = [] } = useStockBearingLocationsForCompany(selectedCompany?.id);
  const filteredLocations = stockLocations;
  ```
- In the `<SelectItem>` render, indent sub-locations using their `depth` field (e.g. `'\u00A0\u00A0'.repeat(depth) + name`) so the hierarchy is visually clear (SAP Fiori tree-pattern).
- Drop the unused `useWarehouseLocations` import if no longer needed.

No DB / RPC / type changes. The existing auto-default and company helper text continue to work because the returned shape includes `id` and `name`.

## Out of scope
Other dialogs (transfer, return, request) — separate request if the same fix is needed there.
