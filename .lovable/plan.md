## Plan: Make “Bulk add from catalog” item search reliable

### Problem
The picker is calling `list_warehouse_catalog`, but the requests are timing out (`57014 canceling statement due to statement timeout`). Because the RPC times out, the UI shows “No items found” even though items exist in the item master.

### Best-practice fix
1. **Replace the slow catalog list/search SQL with an indexed pattern**
   - Keep the existing `list_warehouse_catalog` RPC signature and return columns so the UI does not break.
   - Remove the expensive full-table `count(*) OVER ()` and token `ILIKE` scan that is causing timeouts.
   - Use indexed predicates for active item master rows and keyset pagination.
   - Search across item code, name, SKU, barcode, brand, manufacturer, and description.

2. **Use international-standard search behavior**
   - Exact item code match ranks first.
   - Prefix matches rank next.
   - Full-text phrase/token search handles multi-word item names.
   - Trigram fallback handles partial words and typos such as “sand”, “sands”, or reordered phrases.
   - Escape user input safely to avoid wildcard/special-character search failures.

3. **Improve database indexes**
   - Add/ensure GIN full-text index for the item master searchable fields.
   - Add trigram indexes for name and item code, plus optional SKU/barcode indexes if needed.
   - Add a status + created_at + id keyset index for fast first-page loading.

4. **Improve the picker UI state**
   - Keep the existing debounced input.
   - Show a real error message if the catalog RPC fails instead of silently displaying “No items found”.
   - Keep the current infinite-scroll “Load more” behavior.

5. **Verify**
   - Confirm the RPC returns rows for no search, single-word searches like `sand`, and multi-word item-name phrases.
   - Confirm active item master items appear in the bulk-add picker without timeout.

### Files to change
- Add a new Supabase migration for `list_warehouse_catalog` and supporting indexes.
- Update `src/components/warehouse/bulk-catalog-import/CatalogItemCell.tsx` to display RPC errors clearly.