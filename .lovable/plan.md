

## Fix: Bulk Stock Upload — Opening Stock Not Working

### Root Causes

**1. Wrong `quantity_before` / `quantity_after` in stock transactions**
The `sync_item_stock_from_bins` trigger fires immediately when a bin allocation is inserted/updated (lines 394-410). By the time the code reads `current_stock` at line 413-419, the trigger has already updated it to include the new allocation. So:
- `quantity_before` = already-updated value (includes the new stock)
- `quantity_after` = quantity_before + row.quantity = **double-counted**

This corrupts the stock transaction audit trail and makes opening stock records meaningless.

**2. `location_id` never set on items**
New items created at lines 349-381 and reactivated items at lines 321-346 never set `location_id`. This means all bulk-uploaded items have `location_id = null`, which then breaks the stock audit/reconciliation (the exact issue we've been fixing).

**3. No error handling on Supabase calls**
The bin allocation insert (line 401-409) and update (line 396-399) don't check for errors. A silent RLS or constraint failure means the item appears "processed" but no allocation was actually created.

### Fix Plan

**File: `src/components/warehouse/BulkStockUploadDialog.tsx`**

**Fix 1 — Read `current_stock` BEFORE updating bin allocation**
Move the `current_stock` read (lines 413-419) to BEFORE the bin allocation insert/update (lines 386-410). This captures the true pre-change value before the trigger fires.

**Fix 2 — Set `location_id` on items**
When creating new items (line 352) or reactivating existing items (line 325), include `location_id: effectiveLocationId` (the selected warehouse location).

**Fix 3 — Add error handling on allocation operations**
Check for errors on the bin allocation insert and update calls. Throw on failure so the item correctly counts as failed.

### Files Modified
- `src/components/warehouse/BulkStockUploadDialog.tsx` — all three fixes in this single file

