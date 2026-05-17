## Why this is happening

The inventory screen is not losing stock data. The browser network logs show repeated calls to `list_warehouse_inventory` failing with:

```text
canceling statement due to statement timeout
```

When that database RPC times out, the frontend currently falls through to the empty-table message, so it incorrectly shows “Loaded 0 items” / “No inventory…” even though stock exists. After several refreshes, one request sometimes finishes before the timeout, so the correct stock appears.

There are two root causes:

1. **Database query is too expensive under real inventory volume**
   - `list_warehouse_inventory` builds candidates from stock allocations, joins catalog/categories/units/suppliers, aggregates bins and stock owners, applies company/location/security filters, then paginates.
   - The current structure can scan/aggregate too much data before applying the final page limit.

2. **Frontend masks backend timeout as “no stock”**
   - The hook throws an error, but the table only checks `isLoading` and `filteredItems.length`.
   - A timeout should be shown as a loading/error state, never as “No inventory”.

## Best-practice solution

### 1. Fix the database reader first
Create a new migration for `list_warehouse_inventory` that follows enterprise WMS/SAP-style list-reader standards:

- Apply **company, location, stock mode, status, category, supplier, owner, and search filters before expensive joins**.
- Use **keyset pagination** on `(created_at, id)` and return only the current page.
- Aggregate bins and stock owners only for the page rows, not for the whole inventory set.
- Preserve strict multi-tenant access via `public.can_access_company(...)`.
- Preserve location-scoped stock logic: stock remains scoped by `(company, item, location, bin)`.
- Keep the RPC signature unchanged so existing frontend calls keep working.

### 2. Add production-grade indexes
Add/verify targeted indexes for the actual access paths:

- `warehouse_items(company_id, created_at DESC, id DESC)` for fast company-scoped pagination.
- `warehouse_items(location_id, company_id)` for zero-stock/location fallback paths.
- `warehouse_items(catalog_item_id)` for catalog joins.
- `warehouse_bin_allocations(company_id, location_id, warehouse_item_id)` for location-scoped stock lookup.
- Partial allocation index where `allocated_quantity > 0` for in-stock/bin aggregation paths.
- Catalog search support for `item_code`, `name`, `barcode`, `sku` using indexed text search/trigram where appropriate.

This is the international-standard pattern: list pages use narrow indexed readers, not broad table scans plus late filtering.

### 3. Fix frontend error handling
Update `ItemMasterTab.tsx` and `useWarehouseItemsLazyInventory.ts` so timeouts are visible and recoverable:

- Read `isError`, `error`, and `refetch` from the inventory query.
- Show a clear table state: “Inventory could not load. Retry.” instead of “No inventory”.
- Keep existing data visible while refetching where possible, so the table does not flicker to empty.
- Prevent repeated request storms while context is still settling.

### 4. Stabilize request timing
Update the inventory hook to avoid premature heavy calls:

- Wait until company context and location permissions are resolved before calling the RPC.
- Avoid the initial `_company_id: null` all-company query unless the user is explicitly in all-company mode.
- Keep the 50-row initial page size and cache reuse already added.

### 5. Validate with the real failing case
After implementation:

- Verify the network call no longer returns `57014 statement timeout`.
- Test the selected company/location shown in the screenshot.
- Search for `ALA056` and confirm it appears when stock exists in the selected company/location/bin scope.
- Confirm real empty inventory still shows the normal “No inventory…” message, while backend failures show an error state.

## Files to change

- `supabase/migrations/<new>_optimize_inventory_reader.sql`
- `src/hooks/useWarehouseItemsLazyInventory.ts`
- `src/components/warehouse/ItemMasterTab.tsx`

## Expected result

Inventory should load consistently without repeated refreshes, stock should not falsely show as missing, and backend failures should be clearly reported instead of being presented as empty inventory.