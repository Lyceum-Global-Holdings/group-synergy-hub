
Fix the import dialog visibility bug by refreshing the catalog-exclusion cache when an item is removed from inventory.

What I found:
- `AddFromCatalogDialog.tsx` already excludes only inventory rows with `current_stock > 0`, which is correct.
- The dialog also already uses restore-or-insert logic, so re-import itself is not the main blocker anymore.
- In the database, “Scapel Blade” is still active in `warehouse_item_catalog` and no longer exists in `warehouse_items`, so it should be available to import.
- The likely issue is stale React Query state:
  - `AddFromCatalogDialog` builds its hidden-item set from query key `['warehouse-items-catalog-ids', selectedCompany?.id]`.
  - When deleting/removing from inventory in `ItemMasterTab.tsx`, the app invalidates only `['warehouse-items-inventory']`.
  - It does not invalidate `['warehouse-items-catalog-ids', companyId]`, so the dialog can keep using the old exclusion set and hide the item until a hard refresh.

Plan:
1. Update the inventory removal success path in `src/components/warehouse/ItemMasterTab.tsx`.
2. After `remove_item_from_inventory` succeeds, also invalidate:
   - `['warehouse-items-catalog-ids', selectedCompany?.id]`
   - `['warehouse-items']` if needed for any shared inventory lists
   - optionally `['warehouse-bin-allocations']` since removal clears allocations
3. Keep the existing `current_stock > 0` filter and restore-or-insert logic in `AddFromCatalogDialog.tsx` unchanged unless testing reveals a second issue.
4. Verify the flow:
   - remove “Scapel Blade” from inventory
   - open Import from Catalog without refreshing
   - confirm it appears immediately
   - re-import it successfully

Technical detail:
- Root cause is not the SQL filter anymore; it is cache invalidation mismatch between the delete flow and the import dialog’s exclusion query.
- This is why the item can exist correctly in the database but still remain hidden in the UI.
