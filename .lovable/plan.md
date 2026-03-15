

# Fix: "cannot insert a non-DEFAULT value into column available_quantity"

## Root Cause

`available_quantity` is a **GENERATED ALWAYS** column on both:
- `warehouse_items`: computed as `current_stock - COALESCE(reserved_quantity, 0)`
- `warehouse_bin_allocations`: computed as `allocated_quantity - reserved_quantity`

PostgreSQL rejects any INSERT or UPDATE that explicitly sets a generated column. The code has multiple places that attempt to write to these columns.

## Changes

### 1. `src/hooks/useStockAudit.ts`
Remove `available_quantity` from both UPDATE calls to `warehouse_bin_allocations` (lines 201 and 253). The database computes this automatically.

### 2. `src/integrations/supabase/types.ts`
Remove `available_quantity` from the `Insert` and `Update` types for both `warehouse_bin_allocations` and `warehouse_items` tables. This prevents any future accidental writes to the generated column. (The `Row` type keeps it for reads.)

### 3. Verify no other writes
Other files writing `available_quantity` (`useWarehouseTools.ts`, `useToolIssues.ts`, `useToolAdjustments.ts`, `useToolReturns.ts`) target `warehouse_tools`, which has a regular (non-generated) column — those are fine and stay unchanged.

