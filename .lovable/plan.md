

## Add Bin Allocation on GRN Approval

### Overview
When approving a GRN, show a dialog where the user selects a bin for each GRN item before confirming approval. The approval process then allocates stock to the selected bins via `warehouse_bin_allocations`.

### Current Flow
- User clicks "Approve GRN" → directly updates status to `approved`
- DB trigger `update_stock_on_grn_approval` updates `warehouse_items.current_stock`
- **No bin allocation happens** — stock goes to item master but not to any bin

### New Flow
1. User clicks "Approve GRN" → opens a **Bin Allocation Dialog**
2. Dialog lists each GRN item with a bin selector (dropdown of active bins filtered by location)
3. User selects a bin for each item (or uses a default bin)
4. On confirm, the approval:
   - Updates GRN status to `approved`
   - The existing trigger updates `warehouse_items.current_stock`
   - Frontend then upserts `warehouse_bin_allocations` for each item+bin combo
   - Updates `warehouse_bins.current_quantity`

### Implementation

**1. New component: `GrnBinAllocationDialog.tsx`**
- Props: GRN items, open/onConfirm/onCancel
- For each item: shows item name, qty received, and a bin selector (Select dropdown)
- Fetches active bins from `warehouse_bins` where `status = 'active'`
- Validates all items have a bin selected before allowing confirm
- Returns array of `{ grn_item_id, warehouse_item_id, bin_id, quantity }` on confirm

**2. Update `useApproveGoodsReceiptNote` hook**
- Accept bin allocations as parameter: `Array<{ warehouse_item_id, bin_id, quantity, company_id }>`
- After GRN status update succeeds, upsert into `warehouse_bin_allocations`:
  - If allocation exists for same `warehouse_item_id + bin_id`, increment `allocated_quantity`
  - Otherwise insert new row
- Also increment `warehouse_bins.current_quantity`

**3. Update `GrnDetailsDialog.tsx`**
- Replace direct `handleApprove` call with opening the bin allocation dialog
- On dialog confirm, call the updated approve mutation with allocations

### Files to Create
- `src/components/warehouse/GrnBinAllocationDialog.tsx`

### Files to Edit
- `src/hooks/useGoodsReceiptNotes.ts` — update `useApproveGoodsReceiptNote` to accept and process bin allocations
- `src/components/warehouse/GrnDetailsDialog.tsx` — add dialog state and wire up

### Technical Notes
- `warehouse_bin_allocations` has: `warehouse_item_id`, `bin_id`, `allocated_quantity`, `reserved_quantity`, `company_id`, `created_by`
- `available_quantity` is a generated column (cannot insert/update directly)
- Bins are shared across companies (scoped by `location_id`), but allocations are scoped by `company_id`
- Per architecture memory: stock updates should go through bin allocations as source of truth

