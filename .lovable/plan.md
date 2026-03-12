

# Multi-Item CPO to Production Orders

## Problem
Currently, a production order holds a single `product_name` + `target_qty`. But a CPO can have multiple items (`customer_po_items`), each with its own `item_name`, `style_no`, `quantity_ordered`, `color`, `size`. The user needs all CPO items represented in production.

## Recommended Approach: One Production Order Per CPO Item

Rather than adding a sub-items layer to production orders (which complicates stage tracking), the best approach is: when a CPO is selected, fetch its items, let the user pick which ones to send to production, and **batch-create one production order per selected CPO item**. Each order gets its own independent stage pipeline.

This keeps the existing stage/cost tracking intact and gives clear per-item WIP visibility.

## Database Change

Add a `cpo_item_id` column to `production_orders` so each order links back to the specific CPO line item:

```sql
ALTER TABLE production_orders
  ADD COLUMN cpo_item_id uuid REFERENCES customer_po_items(id);
```

No other schema changes needed.

## Frontend Changes

### 1. Update `useCPOs` hook
Fetch CPO items along with each CPO:
```
.select("id, cpo_number, notes, total_amount, items:customer_po_items(*)")
```

### 2. Redesign `CreateProductionOrderDialog.tsx`

**New flow when a CPO is selected:**
1. User selects a Sector
2. User selects a CPO → system fetches and displays all CPO items in a checklist table (columns: item_name, style_no, color, size, qty_ordered)
3. User checks which items to produce (select all by default)
4. Optionally link a BOM
5. Shared fields: start_date, due_date, notes apply to all created orders
6. Click "Create Orders" → batch-creates one production order per checked item, with `product_name = item_name`, `style_no = item.style_no`, `target_qty = item.quantity_ordered`, `cpo_item_id = item.id`

**When no CPO is selected:** behaves as today (manual single product entry).

### 3. Update `useCreateProductionOrder` hook
- Accept an array of items instead of a single product
- Loop through each item, insert a production_order, create stages, and populate BOM costs
- Or expose a new `useCreateBatchProductionOrders` mutation

### 4. Update `ProductionOrdersList.tsx`
- Show `cpo_item_id` relationship info (color, size) in the table for orders linked to CPO items
- Group orders by CPO number visually

### 5. Update `ProductionOrderDetail.tsx`
- Display CPO item details (color, size, unit_price) in the order header when linked

## Summary of Changes

| Area | Change |
|------|--------|
| Migration | Add `cpo_item_id` column to `production_orders` |
| `useProduction.ts` | Update `useCPOs` to include items; add batch creation logic |
| `CreateProductionOrderDialog.tsx` | CPO item checklist UI, batch order creation |
| `ProductionOrdersList.tsx` | Show CPO item details in table |
| `ProductionOrderDetail.tsx` | Display linked CPO item info in header |

