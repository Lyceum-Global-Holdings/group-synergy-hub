## Problem

Users with the `user` role cannot see any rows on the **Material Returns** tab (empty "No results"), while Material Issues on the same screen work fine.

## Root cause

The RLS SELECT policy on `material_return_notes` is stricter than the sibling table `material_issue_notes`:

- `material_issue_notes` SELECT: `can_access_company(company_id)` — any user with company access sees the row.
- `material_return_notes` SELECT: `can_access_company(company_id) AND (is_admin(auth.uid()) OR (location_id IS NOT NULL AND user_has_location_access(auth.uid(), location_id)))`

Regular `user`-role accounts typically don't have explicit per-location grants, so every MRN is filtered out for them. Additionally, 4 of the 24 existing MRN rows have `location_id IS NULL`, which the policy also excludes even for users who do have location access.

## Fix

Align the MRN SELECT policy with MIN so visibility is purely company-scoped (matches how the Material Issues tab already behaves and matches user expectation that anyone in the company can see returns raised in that company). Keep the stricter INSERT/UPDATE/DELETE policies unchanged — writing/approving still requires location access or admin.

### Migration

```sql
DROP POLICY "Users can view material return notes scoped by location"
  ON public.material_return_notes;

CREATE POLICY "Users can view material return notes in their company"
  ON public.material_return_notes
  FOR SELECT
  USING (can_access_company(company_id));
```

No client-side changes are needed — `useMaterialReturns` already queries by `company_id` and the optional global location filter.

## Verification

1. Sign in as a `user`-role account that belongs to the company and open **Warehouse → Material Issue / Return → Material Returns** — the list populates.
2. Confirm the same account still **cannot** create/approve/delete an MRN outside their allowed locations (INSERT/UPDATE/DELETE policies untouched).
3. Admin/super_admin behaviour unchanged.
