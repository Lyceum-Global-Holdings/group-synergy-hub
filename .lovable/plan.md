# Remove Stock Movement Trends chart from Inventory page

## Change

- **`src/pages/warehouse/Inventory.tsx`** — delete the `DeferredStockMovementChart` wrapper, the lazy `StockMovementChart` import, and the `<DeferredStockMovementChart />` render. Page renders only the `ItemMasterTab`.

## Cleanup (no functional change elsewhere)

- **`src/components/warehouse/StockMovementChart.tsx`** — delete the file (no other importers after the Inventory page stops using it).
- **`src/components/warehouse/ItemSearchCombobox.tsx`** — keep. It's a reusable async picker that future selectors can adopt; no cost when unused.
- **`src/hooks/useStockMovementAnalytics.*`** — keep. Used by other dialogs (e.g. stock movement dialog/report) per the project layout; only the chart on the Inventory landing is being removed.

## Out of scope

- No DB changes. No removal of the analytics RPC.
- No changes to `ItemMasterTab`, realtime hooks, or the relocate-bin flow.

## Acceptance

- `/warehouse/inventory` shows the page header and the Item Master table only.
- No `StockMovementChart` chunk is fetched, no recharts cost, no 30-day analytics query on this route.
