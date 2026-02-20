
# Fix: Stock Goes Below Zero on Material Issue

## Root Cause (Confirmed by Database Analysis)

The `process_material_issue_stock_update` RPC function has a **dual-path stock management conflict** that causes desyncs and potential negative stock.

### How stock is currently managed:

The function does two separate writes:
- **Step 3**: `UPDATE warehouse_items SET current_stock = current_stock - qty` (direct write)
- **Step 4**: `UPDATE warehouse_bin_allocations SET allocated_quantity = allocated_quantity - qty`

Step 4 fires the `trg_sync_item_stock_after_bin_allocation` trigger, which **overwrites** `warehouse_items.current_stock` with `SUM(bin.allocated_quantity)` for all bins of that item.

### The bug — two scenarios:

**Scenario A: Item has a bin (bin_allocation_id is provided)**
- Step 3 reduces `current_stock` directly to e.g. 90
- Step 4 reduces bin to 90, trigger fires and sets `current_stock = SUM(bins) = 90`
- Step 3's write is immediately overwritten. Result is technically correct but fragile.

**Scenario B: Item has NO bin (bin_allocation_id is NULL — items issued without a reservation)**
- Step 3 reduces `current_stock` directly (e.g. 1000 → 993)
- Step 4 is skipped. Trigger never fires.
- Bins still show full quantity (1000), `warehouse_items.current_stock = 993`
- **Desync is created** — confirmed in the database: `zipper 8in Gray` current_stock=993 but bins=1000, `Size Lable` current_stock=910 but bins=1000, `Waistband stripe White` current_stock=60 but bins=100

**Scenario C: Duplicate MIN (the previously fixed double-click bug)**
- Both calls passed `NULL` bin_allocation_id, so Step 3 ran twice against warehouse_items
- Stock was deducted twice, potentially going negative

## The Fix

### 1. Update RPC `process_material_issue_stock_update` (Database Migration)

The function must **always update through bins when the item has bin allocations** — even when no `bin_allocation_id` is explicitly provided. This mirrors the architecture principle from memory: all stock updates must go through bin allocations atomically.

Updated logic:
- If `p_bin_allocation_id` is NULL, look up any bin allocation for the item (scoped to the item's existing bins)
- If a bin allocation is found, update it instead of directly updating `warehouse_items` (the trigger handles `warehouse_items` automatically)
- If no bin allocation exists at all, fall back to the direct `warehouse_items` update (for items not managed via bins)
- Add a **stock check** that reads `SUM(bin allocated_quantity)` instead of `warehouse_items.current_stock` when bins exist, preventing the split-brain check

### 2. No changes needed to `useMaterialIssueItems.ts`

The hook already tries to find a `bin_allocation_id` from the reservation. The RPC itself will now handle the fallback lookup when no bin_allocation_id is passed.

## Technical Details

### Database Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.process_material_issue_stock_update(
  p_item_id uuid,
  p_quantity_issued numeric,
  p_bin_allocation_id uuid DEFAULT NULL,
  p_min_id uuid DEFAULT NULL,
  p_min_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_warehouse_item RECORD;
  v_bin_allocation RECORD;
  v_resolved_bin_alloc_id uuid;
  v_available_stock numeric;
  v_has_bins boolean;
BEGIN
  -- 1. Lock and get the warehouse item
  SELECT * INTO v_warehouse_item
  FROM warehouse_items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  -- 2. Check if item has any bin allocations
  SELECT EXISTS(
    SELECT 1 FROM warehouse_bin_allocations WHERE warehouse_item_id = p_item_id
  ) INTO v_has_bins;

  -- 3. Determine effective stock and bin allocation to use
  IF v_has_bins THEN
    -- Use bin total as the source of truth
    SELECT COALESCE(SUM(allocated_quantity), 0) INTO v_available_stock
    FROM warehouse_bin_allocations WHERE warehouse_item_id = p_item_id;
    
    -- Resolve which bin to deduct from
    v_resolved_bin_alloc_id := p_bin_allocation_id;
    IF v_resolved_bin_alloc_id IS NULL THEN
      -- Pick the bin with the most available quantity for this item
      SELECT id INTO v_resolved_bin_alloc_id
      FROM warehouse_bin_allocations
      WHERE warehouse_item_id = p_item_id
        AND allocated_quantity >= p_quantity_issued
      ORDER BY allocated_quantity DESC
      LIMIT 1;
      
      -- Fallback: pick any bin even if not enough (will use GREATEST(0,...))
      IF v_resolved_bin_alloc_id IS NULL THEN
        SELECT id INTO v_resolved_bin_alloc_id
        FROM warehouse_bin_allocations
        WHERE warehouse_item_id = p_item_id
        ORDER BY allocated_quantity DESC
        LIMIT 1;
      END IF;
    END IF;
  ELSE
    -- No bins: use warehouse_items.current_stock directly
    v_available_stock := v_warehouse_item.current_stock;
    v_resolved_bin_alloc_id := NULL;
  END IF;

  -- 4. Stock check
  IF v_available_stock < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %',
      v_available_stock, p_quantity_issued;
  END IF;

  -- 5. Record stock movement
  INSERT INTO warehouse_stock_movements (
    warehouse_item_id, bin_allocation_id, movement_type,
    reference_type, reference_id, reference_number,
    quantity_change, quantity_before, quantity_after,
    notes, created_by, created_at
  ) VALUES (
    p_item_id, v_resolved_bin_alloc_id, 'issue',
    'material_issue', p_min_id, p_min_number,
    -p_quantity_issued, v_available_stock, v_available_stock - p_quantity_issued,
    'Material issued via MIN: ' || COALESCE(p_min_number, 'Unknown'),
    auth.uid(), NOW()
  );

  -- 6. Update stock through the correct path
  IF v_resolved_bin_alloc_id IS NOT NULL THEN
    -- Update bin allocation (trigger will sync warehouse_items.current_stock automatically)
    UPDATE warehouse_bin_allocations
    SET
      allocated_quantity = GREATEST(0, allocated_quantity - p_quantity_issued),
      reserved_quantity  = GREATEST(0, reserved_quantity - p_quantity_issued),
      available_quantity = GREATEST(0, allocated_quantity - p_quantity_issued - GREATEST(0, reserved_quantity - p_quantity_issued)),
      updated_at = NOW()
    WHERE id = v_resolved_bin_alloc_id;
    -- NOTE: The trg_sync_item_stock_after_bin_allocation trigger will update
    -- warehouse_items.current_stock = SUM(bins) automatically.
  ELSE
    -- No bins exist: update warehouse_items directly
    UPDATE warehouse_items
    SET current_stock = current_stock - p_quantity_issued, updated_at = NOW()
    WHERE id = p_item_id;
  END IF;

  -- 7. Also reduce reserved_quantity on warehouse_items
  UPDATE warehouse_items
  SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity_issued), updated_at = NOW()
  WHERE id = p_item_id;

END;
$$;
```

### Key Changes from Original:
- **Removed** Step 3's direct `UPDATE warehouse_items SET current_stock = current_stock - qty` when bins exist (was redundant and caused split-brain)
- **Added** automatic bin resolution: if no bin_allocation_id is passed but bins exist, the function picks the best bin to deduct from
- **Fixed** the stock check to use `SUM(bin allocated_quantity)` when bins exist, not `warehouse_items.current_stock` (which could be out of sync)
- The trigger `trg_sync_item_stock_after_bin_allocation` now solely owns writing `warehouse_items.current_stock` when bins are present

## Summary

- 1 database migration (update `process_material_issue_stock_update` RPC)
- 0 frontend file changes
- Prevents negative stock by routing all bin-managed items through their bin allocations
- Prevents desync between `warehouse_items.current_stock` and bin totals
- Existing desynced items (zipper, Size Lable, Waistband stripe) will self-correct on next bin update via trigger; alternatively the user can re-sync them by running `UPDATE warehouse_bin_allocations SET updated_at = NOW()` for affected items
