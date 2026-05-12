# Move Stock Movement Trend chart to Inventory

## Goal
The 30-day Stock Movement Trend chart currently sits at the top of the Item Master tab (master-data screen). It belongs with on-hand stock data. Move it to the new **Inventory** page (`/warehouse/inventory`) and scope it to the warehouse currently selected in the global location header — matching SAP EWM / Oracle WMS conventions where movement KPIs live alongside on-hand stock and are filtered by the active warehouse.

## Changes

1. **`src/hooks/useStockMovementAnalytics.ts`**
   - Accept an optional `locationId` parameter.
   - When provided, add `.eq('location_id', locationId)` to the `stock_transactions` query.
   - Include `locationId` in the React Query `queryKey` so cache is per warehouse.
   - Honors existing memory rule: `stock_transactions` is scoped per `(item_id, location_id)` — filtering by location is the standard reader pattern.

2. **`src/components/warehouse/StockMovementChart.tsx`**
   - Read `globalLocationId` from `useLocationFilter()`.
   - Pass it to `useStockMovementAnalytics(itemId, globalLocationId)`.
   - Title becomes `Stock Movement Trends (30 Days)` with a small subtitle showing the active warehouse name when one is selected, or `All Warehouses` otherwise (look up name via `useWarehouseLocations` if available; fall back to "All Warehouses").
   - Keep the existing item selector. No other behavioral changes.

3. **`src/pages/warehouse/Inventory.tsx`**
   - Render `<StockMovementChart />` (lazy) above the `ItemMasterTab` block, inside the same `<Suspense>`.

4. **`src/components/warehouse/ItemMasterDefinitionTab.tsx`**
   - Remove the `StockMovementChart` lazy import and its `<Suspense>` render at line 262.
   - Item Master page becomes pure master-data (no analytics), Inventory page owns the trend chart.

## Out of scope
- No DB / RPC / RLS changes — the existing `stock_transactions.location_id` column and RLS already enforce company scope.
- No change to the global header location selector.
- No change to `ItemMasterTab` itself or to other consumers of `useStockMovementAnalytics`.

## Technical notes
- `useStockMovementAnalytics` already filters by `company_id` via `CompanyContext`; the new `locationId` filter layers on top.
- Chart re-fetches automatically when the user switches warehouse via the global header (queryKey change).
- When `globalLocationId` is `null` (All Warehouses), behavior is identical to today.
