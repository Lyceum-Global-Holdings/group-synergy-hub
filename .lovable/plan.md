## Why everyone still sees every MRN

The previous migration added `location_id` and a new SELECT policy, but the policy keeps a fallback clause:

```
... AND (location_id IS NULL OR is_admin(...) OR user_has_location_access(...))
```

Database state right now:
- All 20 `material_return_notes` rows have `location_id = NULL`
- 16 of them also have `company_id = NULL` (reference_type = `other`)
- The 4 rows linked to a Material Issue Note did not get backfilled (prior backfill JOIN didn't match)

Result: every authenticated user passes the policy via the `location_id IS NULL` branch, so the list is effectively unscoped — exactly what the user is reporting.

## Fix

### 1. Migration — backfill + lock down

1. **Backfill `location_id` from MIN** for rows where `reference_type IN ('material_issue','material_issue_note')` and `reference_id` matches a `material_issue_notes.id` (cast safely).
2. **Backfill `company_id`** the same way (from the linked MIN) for the 4 MIN-linked rows currently NULL.
3. For remaining legacy rows that still have `location_id IS NULL` after backfill, set `location_id` to the creator's primary accessible location when uniquely determinable (`user_location_assignments` → fall back to the most-used location on `material_issue_notes` by the same `created_by` in the same company). Any row that still can't be resolved is marked admin-only by leaving `location_id` NULL **and** flipping a new behaviour: NULL no longer grants access (see step 5).
4. **Add NOT NULL guard going forward**: a `BEFORE INSERT` trigger raises if `location_id` is NULL for new rows (we don't add a NOT NULL constraint yet so unresolved legacy rows aren't deleted; admins can repair them via the existing repair dialog).
5. **Replace the SELECT policy** to drop the `location_id IS NULL` branch:
   ```
   USING (
     can_access_company(company_id)
     AND (
       is_admin(auth.uid())
       OR (location_id IS NOT NULL AND user_has_location_access(auth.uid(), location_id))
     )
   )
   ```
   Apply the same tightening to UPDATE's USING/CHECK and INSERT's CHECK (remove the NULL escape; admins can still create/edit, others must supply a valid location).
6. **Tighten `material_return_items` SELECT policy** the same way — currently it inherits visibility from the parent; re-create it so item rows are only visible when the parent MRN passes the new (no-NULL) check, preventing leakage through item-side queries.
7. Index already exists from prior migration; no change.

### 2. Frontend (small follow-ups)

- `useMaterialReturns.ts`: drop the `.or('location_id.is.null,...')` clause now that NULL is no longer publicly visible — keep only the `location_id = globalLocationId` filter (plus no filter when "All locations" is selected, relying on RLS).
- `CreateMaterialReturnDialog.tsx`: keep location required (already done); add a clearer inline error if user picks a location they don't have access to (server will also reject).
- Repair tooling (`BulkRepairMaterialReturnsDialog` / `RepairMaterialReturnDialog`): surface a warning badge for rows still missing `location_id` so admins can re-assign them via a new "Set location" action (uses existing admin-only update policy).

### 3. Verification

- Re-run `SELECT count(*) FROM material_return_notes WHERE location_id IS NULL;` — expect only rows that genuinely couldn't be resolved (admin-visible only).
- Log in as a non-admin user with access to Location A and confirm rows from Location B no longer appear.
- Confirm `material_return_items` are also hidden for non-visible parents.

## Files

- New migration: `..._mrn_location_lockdown.sql` (backfill + policy replacements + insert trigger).
- `src/hooks/useMaterialReturns.ts` (drop NULL OR clause).
- `src/components/warehouse/CreateMaterialReturnDialog.tsx` (validation copy).
- `src/components/warehouse/BulkRepairMaterialReturnsDialog.tsx` + `RepairMaterialReturnDialog.tsx` (optional admin "Set location" affordance).

No changes to other modules.
