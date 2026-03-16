
Fix the Inventory tab so “remove from inventory” actually removes the item from the Inventory list while preserving the Item Master record.

What I found:
- The delete action in `ItemMasterTab.tsx` is already calling `remove_item_from_inventory(...)`.
- That RPC likely succeeds in clearing stock/bin allocations, but the Inventory list still shows the item because `useWarehouseItemsLazyInventory` fetches all `warehouse_items` for the selected company, regardless of whether the item still has live inventory.
- I also found the earlier catalog/inventory split is still incomplete:
  - `SingleItemForm` still uses `useWarehouseItems()` without a global/catalog-aware create path, so “catalog” mode still inserts with `company_id = selectedCompany.id`.
  - `AddFromCatalogDialog` still clones a second `warehouse_items` row into the company instead of attaching inventory to a shared catalog item.

Implementation plan:
1. Fix the Inventory query
- Update `useWarehouseItemsLazyInventory.ts` so Inventory only returns items that actually have inventory presence.
- Use one of these existing signals:
  - items with positive bin allocations, or
  - items with positive `current_stock`, if there are no allocations yet.
- This will make removed items disappear from Inventory immediately after the RPC clears their allocations/stock.

2. Refresh Inventory after removal
- In `ItemMasterTab.tsx`, after successful RPC call, invalidate the inventory query keys so the list refreshes right away.
- Keep the success/error toast handling.

3. Keep Item Master intact
- Do not delete the `warehouse_items` row.
- The Item Master tab should continue showing the item because it represents the catalog.

4. Correct the incomplete separation
- Add a follow-up fix to make Item Master truly global:
  - catalog add/edit should not create company-bound inventory rows,
  - inventory should attach stock/bin allocations to a shared catalog item rather than cloning the item row.
- This is related to the same problem family and will otherwise keep causing confusion.

Technical notes:
- Current issue is not just deletion failure; it is mainly a filtering/modeling problem:
  - Inventory list source = `warehouse_items` rows scoped by `company_id`
  - Remove action = clears allocations/stock only
  - Result = row still exists, so Inventory still renders it
- The current database shape suggests Inventory is still modeled as company-owned `warehouse_items`, while the product requirement says Item Master is global and Inventory is operational presence.
- I would first fix visibility/query behavior now, then normalize the data flow so the same bug does not keep reappearing.

Files to update:
- `src/hooks/useWarehouseItemsLazyInventory.ts`
- `src/components/warehouse/ItemMasterTab.tsx`
- likely also a follow-up pass in:
  - `src/components/warehouse/SingleItemForm.tsx`
  - `src/components/warehouse/AddFromCatalogDialog.tsx`
  - `src/hooks/useWarehouseItems.ts`

Expected result:
- Removing an item from Inventory will hide it from the Inventory tab immediately.
- The item will remain visible in Item Master.
- No catalog row will be deleted.

Technical detail:
```text
Current behavior:
Inventory query = all warehouse_items for selected company
Remove action = clear allocations + set current_stock = 0
=> item still appears in Inventory

Desired behavior:
Inventory query = only items with active stock presence / allocation presence
Remove action = clear allocations + zero stock
=> item disappears from Inventory, remains in Item Master
```
