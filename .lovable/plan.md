

## FIFO Batch-Based Stock Issuance

### Problem
Items are batch-tracked (`item_batches` table with `quantity_remaining`), but the current issue flow (`IssueItemsDialog.tsx`) ignores batches entirely — it deducts stock from `warehouse_items` and bin allocations without consuming from batches or recording `batch_issue_details`.

### Solution
Implement automatic FIFO batch consumption during material issuance. When items are issued, the system will:
1. Query available batches ordered by `created_at ASC` (oldest first = FIFO)
2. Consume from each batch sequentially until the issued quantity is fulfilled
3. Record each batch deduction in `batch_issue_details`
4. Decrement `item_batches.quantity_remaining`
5. Set `batch_allocation_mode = 'fifo'` on the issue item

### Implementation

**1. New DB function: `process_fifo_batch_issue` (migration)**

A SECURITY DEFINER function that:
- Takes `p_issue_item_id`, `p_item_id`, `p_quantity_issued`, `p_company_id`
- Selects from `item_batches` WHERE `warehouse_item_id = p_item_id` AND `company_id = p_company_id` AND `status = 'active'` AND `quantity_remaining > 0` ORDER BY `created_at ASC` (FIFO)
- Loops through batches, consuming `MIN(quantity_remaining, remaining_to_issue)` from each
- Inserts `batch_issue_details` for each consumed batch
- Updates `item_batches.quantity_remaining` (triggers existing `update_batch_status` to auto-set `depleted`)
- Updates `material_issue_items.batch_allocation_mode = 'fifo'`
- Raises exception if total available across batches is insufficient

**2. Update `IssueItemsDialog.tsx`**

In `handleIssue`, after creating stock transactions and before updating warehouse stock:
- For each item, call the new RPC `process_fifo_batch_issue`
- This handles all batch deductions and audit trail automatically
- The existing bin/stock deduction logic remains unchanged (it handles the physical stock side)

**3. Update `IssueItemsDialog.tsx` UI**

Add a "Batch Allocation Preview" section showing which batches will be consumed per item (read-only, computed from available batches in FIFO order). This gives visibility before confirming.

### Files

**New migration** — `process_fifo_batch_issue` function  
**Edit** — `src/components/warehouse/IssueItemsDialog.tsx` — call RPC + add batch preview UI

### Technical Notes
- Existing `update_batch_status` trigger auto-marks batches as `depleted` when `quantity_remaining = 0`
- Expired batches (`status = 'expired'`) are excluded from FIFO selection
- The function uses `FOR UPDATE` row locking on batches to prevent race conditions
- No changes needed to the existing `process_material_issue_stock_update` function — it continues handling bin/stock deductions independently

