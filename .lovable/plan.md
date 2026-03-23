

## Fix: `function min(uuid) does not exist` in `reconcile_stock_batch`

### Problem
The `reconcile_stock_batch` RPC uses `MIN(wba.id)` where `wba.id` is a UUID. PostgreSQL doesn't have a built-in `MIN` aggregate for the `uuid` type.

### Fix
Replace `MIN(wba.id)` with a subquery or cast approach. Simplest: use `(SELECT wba2.id FROM warehouse_bin_allocations wba2 WHERE wba2.warehouse_item_id = v_item_id AND wba2.company_id = p_company_id ORDER BY wba2.allocated_quantity DESC LIMIT 1)` to get the primary allocation (largest qty).

### Implementation
One new migration that recreates `reconcile_stock_batch`, changing:
```sql
-- FROM:
SELECT COALESCE(SUM(wba.allocated_quantity), 0), MIN(wba.id)
INTO v_alloc_total, v_alloc_id
FROM warehouse_bin_allocations wba
WHERE wba.warehouse_item_id = v_item_id AND wba.company_id = p_company_id;

-- TO:
SELECT COALESCE(SUM(wba.allocated_quantity), 0)
INTO v_alloc_total
FROM warehouse_bin_allocations wba
WHERE wba.warehouse_item_id = v_item_id AND wba.company_id = p_company_id;

SELECT wba.id INTO v_alloc_id
FROM warehouse_bin_allocations wba
WHERE wba.warehouse_item_id = v_item_id AND wba.company_id = p_company_id
ORDER BY wba.allocated_quantity DESC
LIMIT 1;
```

### Files
- **New migration**: Fix `reconcile_stock_batch` to avoid `MIN(uuid)`

