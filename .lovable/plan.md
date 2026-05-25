## Plan

1. **Fix the database search function**
   - Add a new Supabase migration that rewrites `public.list_warehouse_catalog`.
   - Qualify the ambiguous `id` reference in the `dedup` CTE as `candidates.id`, because the function returns a column named `id`, which currently conflicts with the CTE column.
   - Keep the existing international-standard search behavior: exact code, code contains, name phrase, SKU/barcode, brand/manufacturer, and full-text search ranking.

2. **Preserve the bulk catalog picker behavior**
   - No UI changes needed in `CatalogItemCell.tsx`; it already calls the catalog RPC correctly with `shouldFilter={false}`.
   - The picker will start returning proper results once the RPC no longer errors.

3. **Verify the fix**
   - Run a read-only RPC check for a sample phrase such as `test` after migration approval.
   - Confirm the search no longer returns `column reference "id" is ambiguous` and returns matching catalog rows or a clean “No items found” state.