

## Plan: Add "Add to My Inventory" from Item Master

### Problem
The Item Master Definition tab shows all items globally, but there's no way to import an item from another company's catalog into the current company's inventory. Users must manually recreate item definitions.

### Solution
Add an "Add to Inventory" action button per item row in the Item Master Definition tab. When clicked, it clones the item definition into the current company's `warehouse_items` with the current `company_id`. Items already in the current company's inventory (matched by `item_code`) are marked with an "In Inventory" badge and the button is disabled.

### How It Works
- The tab already loads ALL items globally (`skipCompanyFilter: true`)
- On render, cross-reference items against the current company's items to identify which `item_code`s already exist
- For items not yet in the current company: show an "Add to Inventory" button
- For items already in the current company: show a green "In Inventory" badge, button disabled
- The clone copies all definition fields (name, category, unit, brand, SKU, barcode, costs, reorder levels) but sets `company_id` to the current company and resets `current_stock` to 0

### Database Compatibility
The unique constraint is `UNIQUE (item_code, company_id)`, so the same `item_code` can exist across different companies -- no schema changes needed.

### Changes

**1. `src/components/warehouse/ItemMasterDefinitionTab.tsx`**
- Fetch the current company's item codes using a lightweight query (just `item_code` from `warehouse_items` where `company_id = selectedCompany.id`)
- Build a `Set<string>` of existing item codes for O(1) lookup
- Add a new action button (e.g., `PackagePlus` icon) per row:
  - If `item.company_id === selectedCompany.id` or item code exists in the set: show "In Inventory" indicator, button disabled
  - Otherwise: clickable "Add to Inventory" button
- On click: insert a new `warehouse_items` row cloning the item's definition fields with `company_id = selectedCompany.id`, `current_stock = 0`
- Show success toast and refresh the existing-items set
- Add a `useMutation` for the clone operation inline

**2. No other file changes needed** -- this is self-contained in the Definition tab.

### Key Technical Detail
```typescript
// Fetch existing item codes for current company
const { data: existingCodes } = useQuery({
  queryKey: ['warehouse-items-codes', selectedCompany?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('warehouse_items')
      .select('item_code')
      .eq('company_id', selectedCompany!.id);
    return new Set(data?.map(d => d.item_code) || []);
  },
  enabled: !!selectedCompany?.id,
});

// In the action column per row:
const alreadyInInventory = item.company_id === selectedCompany?.id 
  || existingCodes?.has(item.item_code);
```

