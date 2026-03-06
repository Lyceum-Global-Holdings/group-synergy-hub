

## Plan: Move "Add to Inventory" to Inventory Tab with Quantity & Bin Assignment

### Problem
The "Add to Inventory" button is currently on the Item Master Definition tab (global catalog view). It should be in the Inventory tab instead, and when adding an item, users need to specify an initial quantity and assign a bin -- not just clone the item definition with zero stock.

### Solution
1. **Remove** the "Add to Inventory" button and related logic from `ItemMasterDefinitionTab.tsx`
2. **Add** a new "Import from Catalog" button in `ItemMasterTab.tsx` (the Inventory tab)
3. **Create** a new dialog `AddFromCatalogDialog.tsx` that:
   - Shows a searchable list of items from the global Item Master that are NOT yet in the current company's inventory (filtered by `item_code` uniqueness)
   - When the user selects an item, presents fields for: **Quantity** and **Bin** (dropdown of available bins for the company)
   - On submit: clones the item definition into `warehouse_items` for the current company, then creates a `warehouse_bin_allocations` record with the specified bin and quantity

### Changes

**1. `src/components/warehouse/AddFromCatalogDialog.tsx`** (new file)
- Dialog with two steps:
  - **Step 1**: Searchable dropdown/combobox of global items not yet in current company (fetched with `skipCompanyFilter: true`, cross-referenced against existing company item codes)
  - **Step 2**: Once item selected, show item details + fields for Quantity (number input) and Bin (select from `warehouse_bins` for the company)
- On confirm:
  1. Insert cloned item into `warehouse_items` with `company_id`, `current_stock: quantity`
  2. Create `warehouse_bin_allocations` record with `warehouse_item_id`, `bin_id`, `allocated_quantity`
- Uses existing `createAllocation` from `useWarehouseBinAllocations` for step 2

**2. `src/components/warehouse/ItemMasterTab.tsx`**
- Add an "Import from Catalog" button (with `PackagePlus` icon) next to existing action buttons
- Wire it to open `AddFromCatalogDialog`

**3. `src/components/warehouse/ItemMasterDefinitionTab.tsx`**
- Remove the `addToInventoryMutation`, `existingCodes` query, and the "Add to Inventory" / "In Inventory" column from the table
- Clean up unused imports (`PackagePlus`, `CheckCircle2`, `useMutation`)

### Flow
```text
Inventory Tab → "Import from Catalog" button → Dialog opens
  → Search & select item from global catalog
  → Enter quantity + select bin
  → Submit → Item cloned + bin allocation created
  → Inventory list refreshes with new item showing stock
```

### Technical Notes
- The stock sync architecture requires that stock goes through bin allocations (source of truth). The dialog will create the bin allocation which triggers the sync to `warehouse_items.current_stock` automatically.
- Duplicate prevention stays the same: match by `item_code` per `company_id`.
- Bins will be fetched from `warehouse_bins` filtered by locations accessible to the user/company.

