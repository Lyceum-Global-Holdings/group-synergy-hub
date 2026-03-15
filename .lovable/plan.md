

# Fix: Bins Not Available for All Companies — Permanent Solution

## Investigation Summary

After exhaustive review of all code, RLS policies, and database constraints, here's what I found:

### Already correct
- `useWarehouseBins.ts` — fetches all bins without company filtering
- `BinMasterTab.tsx` — shows all bins, no company gate
- `CreateBinDialog.tsx` — creates bins without company_id
- RLS policies on `warehouse_bins` — auth-based only, no company filter
- All 15 bins in DB already have `company_id = NULL`
- `ReturnStockFromSublocationDialog.tsx` — uses all bins

### Issues found

**1. Stale database constraint never dropped**
The previous migration to drop `warehouse_bins_bin_code_company_id_key` (unique on `bin_code, company_id`) **failed silently** — the constraint still exists. While it doesn't block reads, it can cause confusing behavior on inserts.

**2. `AddFromCatalogDialog.tsx` writes `available_quantity`**  
Line 111 sets `available_quantity: quantity` on `warehouse_items` insert — this is a GENERATED ALWAYS column and will cause the insert to fail with the same error we fixed before.

**3. `CreateWarehouseBinData` type still has `company_id`**  
In `src/types/itemBin.ts` line 121, the `company_id` field is still present. While optional, it should be removed to prevent accidental use.

## Changes

### Database Migration
- Drop constraint `warehouse_bins_bin_code_company_id_key` (the old `bin_code + company_id` unique constraint that was never removed)

### `src/types/itemBin.ts`
- Remove `company_id` from `CreateWarehouseBinData` interface

### `src/components/warehouse/AddFromCatalogDialog.tsx`
- Remove `available_quantity: quantity` from the warehouse_items insert (line 111) — this is a generated column

These three changes will permanently clean up all remaining bin-related company scoping issues.

