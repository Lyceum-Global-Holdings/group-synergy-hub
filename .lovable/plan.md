

# Fix: Asset Counts Wrong and Assets Not Displaying Correctly

## Root Causes Found

1. **Missing `company_id` on asset creation**: The form collects `company_id` but the `onSubmit` handler never includes it in the data sent to the database. All 4152 assets have NULL `company_id`.
2. **No company filtering on asset queries**: The `useWarehouseAssets` hook fetches all assets from all companies without filtering by the selected company.
3. **No pagination**: The table renders all 4152 rows at once, making it slow and unusable ("cannot see assets correctly").

## Fix Plan

### 1. File: `src/pages/warehouse/AssetManagement.tsx` -- Include `company_id` in asset creation

In the `onSubmit` function (around line 237), add `company_id: data.company_id` to the `assetData` object so newly created assets are properly tagged with the selected company.

### 2. File: `src/hooks/useWarehouseAssets.ts` -- Add company filtering

- Accept an optional `companyId` parameter
- Filter the main assets query with `.eq('company_id', companyId)` when provided
- Filter the count queries the same way so server-side counts also match
- Include `companyId` in all query keys for proper cache separation

### 3. File: `src/pages/warehouse/AssetManagement.tsx` -- Pass company context to hook

- Import `useCompany` from the company context
- Pass `selectedCompany?.id` to `useWarehouseAssets(selectedCompany?.id)`
- This ensures the asset list and counts only show the selected company's assets

### 4. File: `src/pages/warehouse/AssetManagement.tsx` -- Add pagination

Add pagination controls below the asset table:
- Default page size of 50 rows
- Page state tracking (`currentPage`)
- Slice `filteredAssets` for the current page: `filteredAssets.slice((page-1)*50, page*50)`
- Show "Page X of Y" with Previous/Next buttons
- Reset to page 1 when filters change

### 5. Backfill existing NULL `company_id` records

Provide a SQL query the user can run to assign the correct `company_id` to existing assets that currently have NULL values (if the user has a single company, this is straightforward).

## Technical Details

### `useWarehouseAssets.ts` changes:
```
export const useWarehouseAssets = (companyId?: string) => {
  // Main query
  queryKey: ['warehouse-assets', companyId],
  queryFn: async () => {
    let query = supabase.from('warehouse_assets').select('*').order(...).limit(10000);
    if (companyId) query = query.eq('company_id', companyId);
    ...
  }
  // Same pattern for count queries
}
```

### Pagination in `AssetManagement.tsx`:
```
const [currentPage, setCurrentPage] = useState(1);
const pageSize = 50;
const totalPages = Math.ceil(filteredAssets.length / pageSize);
const paginatedAssets = filteredAssets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
// Reset page on filter change
useEffect(() => setCurrentPage(1), [searchTerm, locationFilter, sublocationFilter, categoryFilter]);
// Render paginatedAssets instead of filteredAssets in table body
```

## Files Modified

- `src/hooks/useWarehouseAssets.ts` -- add company filtering parameter
- `src/pages/warehouse/AssetManagement.tsx` -- pass company context, fix company_id on create, add pagination

## Summary

- KPI cards will show correct counts for the selected company
- Asset table will only show the selected company's assets
- Pagination (50 per page) makes the table usable
- New assets will be properly tagged with company_id
- Existing NULL records need a one-time backfill (SQL provided after implementation)

