# Fix: Search in Inventory doesn't find existing items (e.g. ALA056)

## Root cause
`public.list_warehouse_inventory` applies pagination (`LIMIT 50` ordered by `wi.created_at DESC`) in the `base` CTE **before** the search/category/supplier filters run in `joined`. ALA056 was created in Jan 2026 and is not in the most recent 50 `warehouse_items`, so search returns nothing even though the item exists with stock.

Confirmed:
- `warehouse_item_catalog` has `ALA056` (Cladding sheet Board 4x8).
- The matching `warehouse_items` row has `created_at = 2026-01-11`.
- Page-1 keyset cursor only sees the newest 50 rows; search is applied post-pagination.

## Fix (DB migration only)

Recreate `public.list_warehouse_inventory` so the catalog-driven filters (search, category, supplier) are applied **before** pagination:

1. Join `warehouse_item_catalog cat` inside the `base` CTE (LEFT JOIN to tolerate legacy rows; rows without catalog won't satisfy `_search` and that is correct).
2. Move these predicates from `joined` into `base`:
   - `_search ILIKE` over `cat.name`, `cat.item_code`, `cat.brand`, `cat.barcode`, `cat.sku`.
   - `_category_id` against `cat.category_id`.
   - `_supplier_id` against `cat.supplier_id`.
3. `base` continues to `ORDER BY wi.created_at DESC, wi.id DESC LIMIT _limit` and honours the cursor — so pagination now operates on the filtered set.
4. `joined` keeps projecting catalog columns (no further filtering on them).
5. Everything downstream (`with_stock`, `filtered`, `page_bins`, `page_owners`, final select) is unchanged.

Signature, return columns, security, and search_path are preserved.

## Out of scope
- No frontend changes.
- No changes to other RPCs.
- No changes to indexes (existing trigram indexes on `warehouse_item_catalog.name` / `item_code` from memory still apply).

## Files
- New migration: `supabase/migrations/<timestamp>_fix_list_warehouse_inventory_search.sql` (`CREATE OR REPLACE FUNCTION` only).
