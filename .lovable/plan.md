

# Auto-Link BOMs When Selecting CPO Items

## Approach

When CPO items are displayed in the production order dialog, automatically match each item to a BOM using their shared `product_master_id`. Show the matched BOM in the table and use it per-item during batch creation. No manual BOM dropdown needed when CPO items are present.

## Changes

### 1. `src/hooks/useProduction.ts`

**`useCPOs` hook (line 452):** Add `product_master_id` to the `customer_po_items` select fields.

**`useCreateBatchProductionOrders` (lines 225-238):** Change `bom_id` from a shared input field to a per-item field. Each item in the `items` array gets its own `bom_id`. The BOM cost auto-populate logic (lines 274-310) will use the item-specific `bom_id`.

### 2. `src/components/production/CreateProductionOrderDialog.tsx`

- Add `product_master_id` to the fetched CPO item fields
- When CPO items are loaded, auto-match each item to a BOM by finding `boms.find(b => b.product_master_id === item.product_master_id && b.status === 'active')`
- Add a "BOM" column to the CPO items checklist table showing the matched BOM number (or "No match")
- Hide the global "Link to BOM" dropdown when CPO items are present (keep it for manual single-order creation)
- Pass per-item `bom_id` to the batch creation function

### 3. No database changes needed

Both `customer_po_items.product_master_id` and `bill_of_materials.product_master_id` already exist.

