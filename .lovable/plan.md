# Fix: GRN item picker shows full item master

## Root cause
The "Select or type item" dropdown in **Create GRN** only ever renders the first **10** matches (`.slice(0, 10)`), so it looks like the item master isn't loading. On top of that, it downloads all 15,425 catalog rows to the browser before the dropdown becomes useful — slow on first open and against the project's server-pagination standard.

## Changes (frontend only — no database changes)

### `src/components/warehouse/CreateGrnDialog.tsx`
1. Replace the bulk `useWarehouseItemCatalog()` fetch with the server-paginated `useWarehouseCatalogPage` hook (backed by the `list_warehouse_catalog` RPC):
   - Pass the typed text as a debounced (~300 ms) server-side search, so matches come from the **entire** 15k-item master, not a client list.
   - Page size 50, with infinite scroll inside the dropdown list ("load more on scroll") so users can browse the full catalog.
2. Set `shouldFilter={false}` on the `Command` component so cmdk doesn't re-filter the server results.
3. Remove the `.slice(0, 10)` cap and the client-side `.filter(...)`.
4. Keep everything else identical: provision-on-select via `ensure_warehouse_item_for_company`, auto batch-number generation, free-text "press Enter to use" for new item names.
5. Show a small loading spinner row while a search page is being fetched.

## Result
- Typing any part of an item name or code searches the **entire** item master instantly.
- Browsing without typing scrolls through the full catalog (50 at a time), instead of stopping at 10.
- Dialog opens fast — no 15k-row download.
