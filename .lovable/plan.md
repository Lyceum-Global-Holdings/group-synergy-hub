

## Fix: Consolidate Duplicate Bin Allocations and Enforce FIFO for Transfers/Issues

### Problem

1. **Duplicate bin allocations**: 57 item+bin+company combinations have multiple rows in `warehouse_bin_allocations` instead of one consolidated row. This is because there is no unique constraint on `(warehouse_item_id, bin_id, company_id)`. The screenshot shows the same bin (LNPE) appearing 5 times with different quantities (10, 10, 2, 19, 10) in the transfer dropdown.

2. **No FIFO enforcement on transfers**: The transfer dialog picks from individual bin allocation rows but doesn't consider batch age. Per IAS 2 / ISO 22000 / GMP standards, stock should be issued and transferred on a FIFO basis using batch expiry/manufacturing dates.

### Solution

**1. Migration: Consolidate duplicates and add unique constraint**

```sql
-- Merge duplicate rows: keep oldest, sum quantities into it, delete rest
WITH dupes AS (
  SELECT warehouse_item_id, bin_id, company_id,
    MIN(id) as keep_id,
    SUM(allocated_quantity) as total_alloc,
    SUM(reserved_quantity) as total_reserved
  FROM warehouse_bin_allocations
  GROUP BY warehouse_item_id, bin_id, company_id
  HAVING COUNT(*) > 1
)
UPDATE warehouse_bin_allocations wba
SET allocated_quantity = d.total_alloc,
    reserved_quantity = d.total_reserved
FROM dupes d
WHERE wba.id = d.keep_id;

-- Delete the non-kept duplicates
DELETE FROM warehouse_bin_allocations
WHERE id NOT IN (
  SELECT MIN(id) FROM warehouse_bin_allocations
  GROUP BY warehouse_item_id, bin_id, company_id
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE warehouse_bin_allocations
  ADD CONSTRAINT unique_item_bin_company
  UNIQUE (warehouse_item_id, bin_id, company_id);
```

**2. Migration: Create `transfer_stock_fifo` RPC** — A database function that:
- Deducts from source bin allocation
- Adds to destination bin allocation (upsert via the new unique constraint)
- Automatically selects batches FIFO (oldest expiry/manufacturing date first)
- Creates `batch_stock_allocations` records for the destination bin
- Inserts `stock_transactions` for audit trail

**3. Edit `ItemTransferDialog.tsx`** — Fix the bin dropdown to show consolidated allocations (one entry per bin) and call the new FIFO RPC instead of manual allocation updates.

**4. Edit `useGoodsReceiptNotes.ts`** — Replace the manual check-then-insert bin allocation logic with an `ON CONFLICT` upsert that leverages the new unique constraint.

### Technical Details

The FIFO RPC will:
```text
1. Accept: item_id, from_bin_id, to_bin_id, quantity, company_id, user_id
2. Validate: source bin has sufficient available_quantity
3. Select batches from item_batches WHERE warehouse_item_id = item_id
   AND status = 'active' ORDER BY expiry_date ASC NULLS LAST, manufacturing_date ASC, created_at ASC
4. For each batch (FIFO order): deduct min(remaining_transfer_qty, batch.quantity_remaining)
5. Deduct from source warehouse_bin_allocations
6. Upsert into destination warehouse_bin_allocations
7. Log stock_transaction (type: 'transfer')
```

### Files

- **New migration**: Consolidate duplicates, add unique constraint, create `transfer_stock_fifo` RPC
- **Edit**: `src/components/warehouse/ItemTransferDialog.tsx` — use consolidated bins, call FIFO RPC
- **Edit**: `src/hooks/useGoodsReceiptNotes.ts` — simplify bin allocation to use upsert

