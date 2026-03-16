

# Fix: Item Master, Inventory, and Bin Master Visibility — Permanent Solution

## Root Cause Analysis

After deep investigation, there are **three distinct root causes**, not one:

### Problem 1: Item Master shows limited items
The `warehouse_items` table has **only ONE SELECT RLS policy**: `can_access_company(company_id) OR company_id IS NULL`. For non-super-admin users, `can_access_company()` only returns true for their own company. So a user in company A can never see company B's 719 items — the cursor-based pagination works correctly but RLS silently filters rows before they reach the client.

The Item Master Definition tab is designed as a **global catalog** (`skipCompanyFilter: true` in code), but RLS contradicts this intent.

### Problem 2: Inventory shows limited items
Same RLS issue. The `useWarehouseItemsLazyInventory` hook supports `isViewingAllCompanies` mode (skips company filter in the query), but RLS still blocks items from other companies at the database level.

### Problem 3: Bins not visible for all companies
**Different cause.** The `warehouse_bins` RLS policy correctly allows all authenticated users to view all bins. However, `useWarehouseBins.ts` (lines 25-31) has a location permissions guard: when the user has `viewAllLocations = false` AND zero configured location permissions (`permittedLocationIds` is empty), the hook returns `[]` immediately without even querying. All 15 bins have `company_id = NULL` (shared), so RLS is not the problem — the client-side guard is.

## Implementation Plan

### Step 1: Fix RLS policy on `warehouse_items` (database migration)

Replace the single restrictive SELECT policy with one that allows warehouse/procurement/finance users to see ALL items globally (matching the global catalog design), while still enforcing authentication.

```sql
DROP POLICY IF EXISTS "Users can view company warehouse items" ON public.warehouse_items;
DROP POLICY IF EXISTS "Warehouse and procurement users can view warehouse items" ON public.warehouse_items;

-- Global visibility for warehouse/procurement/finance users (Item Master is a global catalog)
CREATE POLICY "Warehouse users can view all items"
ON public.warehouse_items FOR SELECT TO authenticated
USING (
  has_warehouse_access(auth.uid())
  OR has_procurement_access(auth.uid())
  OR has_finance_access(auth.uid())
  OR is_admin(auth.uid())
  OR is_super_admin(auth.uid())
);
```

This permanently removes the company-scoping on SELECT that has been causing repeated breakage. Write/update/delete policies remain company-scoped.

### Step 2: Fix Bin Master hook — remove empty-permissions guard

**File: `src/hooks/useWarehouseBins.ts`**

Change lines 25-32: When user has no explicit location permissions AND `viewAllLocations` is false, **don't return empty array** — just skip the location filter and show all bins. Bins are shared physical resources across companies, so visibility should default to open.

```typescript
// Before (broken):
if (permissions && !permissions.viewAllLocations) {
  const permittedLocationIds = [...new Set(...)];
  if (permittedLocationIds.length > 0) {
    query = query.in('location_id', permittedLocationIds);
  } else {
    return [] as WarehouseBin[];  // ← THIS BLOCKS ALL BINS
  }
}

// After (fixed):
if (permissions && !permissions.viewAllLocations) {
  const permittedLocationIds = [...new Set(...)];
  if (permittedLocationIds.length > 0) {
    query = query.in('location_id', permittedLocationIds);
  }
  // No else — show all bins when no location permissions configured
}
```

### Step 3: Fix Inventory lazy hook — remove location-based bin filtering guard

**File: `src/hooks/useWarehouseItemsLazyInventory.ts`**

Same pattern at lines 106-116: when `permittedLocationIds` is empty, the bins query filter is skipped (correct), but if user has no permissions object, bins won't load. Ensure the enrichment query always runs regardless of permission state, and only applies the location filter when explicit permissions exist.

### Step 4: Fix other components still calling old `useWarehouseItems()` with full fetch

Several components call `useWarehouseItems()` without `disableFetch: true`, triggering redundant full-table queries (`.limit(20000)`):
- `BulkItemImportContent.tsx` line 48: `useWarehouseItems({ skipCompanyFilter: true })` — fetches all items for duplicate checking. Replace with a lightweight duplicate-check query.
- `StockMovementChart.tsx` line 12: `useWarehouseItems()` — fetches all items just for the dropdown. Keep but note it's bounded by RLS + limit.

These are not the primary cause but contribute to performance issues and confusion.

### Summary of changes

| File | Change |
|------|--------|
| Database migration | Replace restrictive SELECT policy with global warehouse-user visibility |
| `src/hooks/useWarehouseBins.ts` | Remove empty-permissions guard that returns `[]` |
| `src/hooks/useWarehouseItemsLazyInventory.ts` | Remove empty-permissions guard in bin enrichment |
| `src/components/warehouse/BulkItemImportContent.tsx` | Optional: optimize duplicate check to avoid full fetch |

### Why this is permanent
Previous fixes tried to work around RLS at the query level (cursor pagination, `skipCompanyFilter`, etc.), but the database policy itself was blocking rows. This fix addresses the **actual constraint** — the RLS SELECT policy — so no amount of client-side query changes can break it again.

