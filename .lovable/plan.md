
# Fix: Item Master Not Visible for Company

## Problem Identified

The `warehouse_items` table has Row Level Security (RLS) enabled but is **missing a SELECT policy**. Without a SELECT policy, no users can read warehouse items from the database, causing the Item Master to appear empty.

Current policies on `warehouse_items`:
- INSERT: Authenticated users can create items
- UPDATE: Users can update their own items, admins can update any
- DELETE: Only admins can delete

**Missing**: SELECT policy to allow reading items

---

## Solution

Create a SELECT policy that allows authenticated users to view warehouse items belonging to their company. This follows the existing company-scoping pattern used throughout the application.

### Database Migration

Create a new RLS SELECT policy on `warehouse_items`:

```sql
-- Enable authenticated users to view warehouse items for their company
CREATE POLICY "Users can view company warehouse items"
ON public.warehouse_items
FOR SELECT
TO authenticated
USING (
  can_access_company(company_id)
  OR company_id IS NULL  -- Legacy items without company assignment
);
```

This policy:
1. Uses the existing `can_access_company()` helper function to verify company membership
2. Super admins can see all items (handled by `can_access_company`)
3. Includes fallback for legacy items with NULL company_id (matching the pattern from `useRepairRecords` and `useLabourMaster` hooks per project memory)

---

## Technical Details

### Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/migrations/[timestamp]_add_warehouse_items_select_policy.sql` | Add SELECT RLS policy |

### Migration SQL

```sql
-- Add missing SELECT policy for warehouse_items
-- This fixes the issue where Item Master shows no items for company users

CREATE POLICY "Users can view company warehouse items"
ON public.warehouse_items
FOR SELECT
TO authenticated
USING (
  can_access_company(company_id)
  OR company_id IS NULL
);

-- Add comment documenting the security model
COMMENT ON TABLE public.warehouse_items IS 
'Warehouse inventory items with company-scoped RLS. SELECT requires company membership via can_access_company().';
```

---

## Verification

After implementation:
1. Select a specific company from the company dropdown
2. Navigate to Item & Bin Master > Item Master tab
3. Items belonging to that company should now be visible
4. Super admins in "All Companies" mode should see all items
