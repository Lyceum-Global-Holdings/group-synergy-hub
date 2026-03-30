

## Fix: Bulk Stock Upload Fails + Slow Performance

### Root Cause

1. **Insert/update failure**: The code sets `available_quantity` on `warehouse_bin_allocations`, but `available_quantity` is a **generated column** (computed automatically by Postgres). You cannot insert or update it directly — every row fails with error `428C9`.

2. **Slow upload**: Each row runs 3-5 sequential Supabase queries (check item, read stock, check allocation, upsert allocation, insert transaction). For 242 rows, that's ~1,000 network round-trips.

### Fix

**1. Remove `available_quantity` from all insert/update operations** in `BulkStockUploadDialog.tsx`:
- Line 408: Remove `available_quantity: newQty` from the `.update()` call
- Line 418: Remove `available_quantity: row.quantity` from the `.insert()` call

**2. Use the existing unique constraint for upsert** — replace the manual check-then-insert/update pattern with a single `.upsert()` call using `onConflict: 'warehouse_item_id,bin_id,company_id'`, eliminating one query per row.

**3. Batch processing for speed** — process rows in parallel batches of 10 using `Promise.allSettled()` instead of sequential `for...of`. This reduces wall-clock time by ~10x.

### Files to Edit
- `src/components/warehouse/BulkStockUploadDialog.tsx` — remove `available_quantity`, use upsert, add parallel batching

