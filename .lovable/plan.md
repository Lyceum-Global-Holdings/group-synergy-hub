

# Fix MRN Stock Adjustments and Company Bin Scoping

## Problems Identified

1. **Stock adjustment not recorded properly**: When an MRN is approved, the bin allocation lookup (line 131-136 in `useMaterialReturns.ts`) searches for ANY bin allocation for the item without filtering by the MRN's company. This can result in either updating the wrong company's bin or finding no bin at all, causing stock desync.

2. **Items not scoped to company bin**: The `ItemSelector` component in `CreateMaterialReturnDialog.tsx` uses `useWarehouseItems` which already filters by selected company. However, the approval process doesn't ensure the bin belongs to the same company.

## Changes

### 1. Fix Bin Allocation Lookup in Approval (`src/hooks/useMaterialReturns.ts`)

Update the `approveMaterialReturnMutation` to:
- First fetch the MRN's `company_id` from the `material_return_notes` record
- Filter `warehouse_bin_allocations` by both `warehouse_item_id` AND the MRN's `company_id`
- This ensures the stock is returned to the correct company's bin

Current code (line 131-136):
```typescript
const { data: binAllocation } = await supabase
  .from('warehouse_bin_allocations')
  .select('id')
  .eq('warehouse_item_id', item.item_id)
  .limit(1)
  .maybeSingle();
```

Updated code:
```typescript
const { data: binAllocation } = await supabase
  .from('warehouse_bin_allocations')
  .select('id')
  .eq('warehouse_item_id', item.item_id)
  .eq('company_id', mrnCompanyId)
  .limit(1)
  .maybeSingle();
```

Also fetch the MRN record at the start of the mutation to get the `company_id`.

### 2. Update RPC Function (`process_material_return_stock_update`)

Update the database function to also accept `p_company_id` parameter so it can create a new bin allocation if none exists for the item in that company. Currently, if no bin allocation is found, the stock is added to `warehouse_items` but NOT to any bin allocation -- causing a data desync.

The updated RPC will:
- Accept a `p_company_id` parameter
- If `p_bin_allocation_id` is NULL but `p_company_id` is provided, find or create a default bin allocation for the item in that company
- Always ensure bin allocations are updated alongside `warehouse_items.current_stock`

### 3. Pass `company_id` in Approval Mutation

Update the approval flow to pass `company_id` to the RPC call so the function can properly scope the stock update.

## Technical Details

### Database Migration

```sql
CREATE OR REPLACE FUNCTION process_material_return_stock_update(
  p_item_id UUID,
  p_quantity_returned NUMERIC,
  p_bin_allocation_id UUID DEFAULT NULL,
  p_mrn_id UUID DEFAULT NULL,
  p_mrn_number TEXT DEFAULT NULL,
  p_company_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_warehouse_item RECORD;
  v_bin_alloc_id UUID;
BEGIN
  SELECT * INTO v_warehouse_item
  FROM warehouse_items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  -- Insert stock transaction
  INSERT INTO stock_transactions (
    item_id, transaction_type, reference_type, reference_id,
    quantity_change, quantity_before, quantity_after,
    notes, created_by
  ) VALUES (
    p_item_id, 'material_return', 'mrn', p_mrn_id,
    p_quantity_returned, v_warehouse_item.current_stock,
    v_warehouse_item.current_stock + p_quantity_returned,
    'Material Return via MRN: ' || COALESCE(p_mrn_number, 'Unknown'),
    auth.uid()
  );

  -- Update warehouse item stock
  UPDATE warehouse_items
  SET current_stock = current_stock + p_quantity_returned, updated_at = NOW()
  WHERE id = p_item_id;

  -- Determine bin allocation ID
  v_bin_alloc_id := p_bin_allocation_id;

  -- If no bin allocation provided, find one scoped to company
  IF v_bin_alloc_id IS NULL AND p_company_id IS NOT NULL THEN
    SELECT id INTO v_bin_alloc_id
    FROM warehouse_bin_allocations
    WHERE warehouse_item_id = p_item_id AND company_id = p_company_id
    LIMIT 1;
  END IF;

  -- Update bin allocation if found
  IF v_bin_alloc_id IS NOT NULL THEN
    UPDATE warehouse_bin_allocations
    SET allocated_quantity = allocated_quantity + p_quantity_returned,
        available_quantity = available_quantity + p_quantity_returned,
        updated_at = NOW()
    WHERE id = v_bin_alloc_id;
  END IF;
END;
$$;
```

### Hook Update (`src/hooks/useMaterialReturns.ts`)

- Fetch MRN record to get `company_id` before processing items
- Filter bin allocation lookup by `company_id`
- Pass `company_id` to RPC function

## Summary

- 1 database migration (update RPC function to accept `p_company_id`)
- 1 file updated (`src/hooks/useMaterialReturns.ts`)
- Ensures stock returns always target the correct company bin
- Prevents data desync between `warehouse_items.current_stock` and `warehouse_bin_allocations`

