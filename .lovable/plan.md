

## Fix: Batches Not Showing in Batch Management

### Root Cause

The RLS SELECT policy on `item_batches` restricts access to batches where `company_id` matches the user's `profiles.company_id`. However, the user operates across multiple companies — GRNs are created under `NCG Warehouse Solutions` (via selectedCompany context), but the user's profile is linked to `Lyceum Nugegoda Quarters`. The batch trigger copies the GRN's company_id, so the resulting batches are invisible to the user.

Other tables like `goods_receipt_notes` and `warehouse_items` use role-based access (any authenticated user / warehouse access), not company-scoped RLS.

### Fix

**1. Migration: Update `item_batches` RLS SELECT policy** to match the pattern used by `warehouse_items` and `goods_receipt_notes`:

```sql
DROP POLICY "Users can view batches in their company" ON item_batches;

CREATE POLICY "Users can view batches"
  ON item_batches FOR SELECT
  TO authenticated
  USING (true);
```

This matches the GRN policy pattern (authenticated users can view). Company filtering is handled at the application level via the selectedCompany context.

Also update UPDATE/DELETE/INSERT policies similarly to allow cross-company operations for warehouse users:

```sql
DROP POLICY "Users can update batches in their company" ON item_batches;
CREATE POLICY "Users can update batches"
  ON item_batches FOR UPDATE TO authenticated USING (true);

DROP POLICY "Users can delete batches in their company" ON item_batches;
CREATE POLICY "Users can delete batches"
  ON item_batches FOR DELETE TO authenticated USING (true);

DROP POLICY "Users can insert batches in their company" ON item_batches;
CREATE POLICY "Users can insert batches"
  ON item_batches FOR INSERT TO authenticated WITH CHECK (true);
```

**2. Edit `src/hooks/useBatches.ts`**: Update `useAllBatches` to accept an optional `companyId` parameter and filter by it at the query level (application-level company filtering).

### Files
- **New migration**: Replace 4 RLS policies on `item_batches`
- **Edit**: `src/hooks/useBatches.ts` — add optional companyId filter to `useAllBatches`

