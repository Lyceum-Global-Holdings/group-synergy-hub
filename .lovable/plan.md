

# Fix: Inventory Deletion Silently Failing

## Root Cause

The deletion handler in `ItemMasterTab.tsx` calls three Supabase operations but **never checks the `.error` response**, so failures are silent. The operations fail because:

1. **`stock_transactions` DELETE policy**: Only allows `is_admin(auth.uid())`
2. **`warehouse_bin_allocations` DELETE policy**: Only allows `is_admin(auth.uid())`
3. **`warehouse_items` UPDATE policy**: Only allows `auth.uid() = created_by OR is_admin(auth.uid())`

Non-admin warehouse users hit RLS denials on all three operations, but see no error.

## Solution

### Step 1: Create a `SECURITY DEFINER` RPC to remove inventory

A database function `remove_item_from_inventory(p_item_id UUID)` that:
- Deletes all `warehouse_bin_allocations` for the item
- Deletes all `stock_transactions` for the item
- Resets `warehouse_items.current_stock` to 0

Using `SECURITY DEFINER` bypasses RLS, matching the pattern already used for other warehouse operations (e.g., stock approval RPCs). Access is gated by checking `has_warehouse_access(auth.uid()) OR is_admin(auth.uid())` inside the function.

### Step 2: Update `ItemMasterTab.tsx` deletion handler

Replace the three raw supabase calls with a single `.rpc('remove_item_from_inventory', { p_item_id: itemId })` call, and properly check the error response. Also handle the `forceDelete` parameter from the dialog (currently ignored).

### Files
| Change | File |
|--------|------|
| New migration | `remove_item_from_inventory` RPC |
| Update handler | `src/components/warehouse/ItemMasterTab.tsx` |

