

## Fix: Add Stock Transaction Records on GRN Approval

### Problem
When a GRN is approved, the DB trigger updates `warehouse_items.current_stock` and the frontend handles bin allocations, but **no `stock_transactions` record is created**. This means GRN receipts don't appear in the stock movement history.

### Solution
After the GRN status is updated to `approved`, insert a `stock_transactions` record for each GRN item with `transaction_type: 'goods_receipt'` and `reference_type: 'grn'`.

### Changes

**Edit `src/hooks/useGoodsReceiptNotes.ts`**

In `useApproveGoodsReceiptNote`, after the GRN status update succeeds (line 333) and before processing bin allocations:

1. Expand the GRN fetch (line 316) to also select `grn_items(id, warehouse_item_id, quantity_received, unit_price, total_cost, item_name)` and `grn_number`
2. For each GRN item that has a `warehouse_item_id`, fetch the item's `current_stock` from `warehouse_items`
3. Insert a `stock_transactions` record:
   - `item_id`: the `warehouse_item_id`
   - `transaction_type`: `'goods_receipt'`
   - `reference_type`: `'grn'`
   - `reference_id`: the GRN id
   - `quantity_change`: `quantity_received` (positive, since it's incoming stock)
   - `quantity_before`: current stock before the trigger fires (fetched before status update)
   - `quantity_after`: `quantity_before + quantity_received`
   - `unit_cost`: `unit_price`
   - `total_value`: `total_cost`
   - `notes`: `"GRN {grn_number} - {item_name}"`
   - `company_id`: from GRN
   - `created_by`: current user

### Technical Detail
The stock quantities (before/after) need to be captured **before** the status update triggers the DB function that increments `current_stock`. So the flow becomes:
1. Fetch GRN with items and `grn_number`
2. For each item, fetch current `warehouse_items.current_stock`
3. Update GRN status → trigger fires, incrementing stock
4. Insert `stock_transactions` records with the pre-captured quantities
5. Process bin allocations (existing code)

