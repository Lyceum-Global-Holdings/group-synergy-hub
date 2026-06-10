# Restrict GRN / MRN / MIN approval to Admin and above

Goal: Only users with role `admin` or `super_admin` can approve Goods Receipt Notes (GRN), Material Return Notes (MRN), and Material Issue Notes (MIN — both HOD and Management approval steps). Enforcement must be both UI-level (hide/disable buttons) and server-side (DB) so it can't be bypassed by API calls.

## 1. Shared role helper (frontend)

Reuse `useIsAdminOrHigher()` (already exists at `src/hooks/useIsAdminOrHigher.ts`, returns `{ canDelete, isLoading }` based on `admin`/`super_admin`/`moderator`).

Add a new tighter helper `useCanApprove()` that returns true **only** for `admin` and `super_admin` (exclude `moderator` per request "admins and above"). Keep `useIsAdminOrHigher` untouched to avoid regressions elsewhere.

## 2. UI gating

- **`src/components/warehouse/GrnDetailsDialog.tsx`** — wrap the "Approve GRN" button (line ~252) so it only renders when `canApprove` is true. Same treatment for any "Submit for Approval → Approve" path on that dialog.
- **`src/components/warehouse/MaterialReturnDetailsDialog.tsx`** — hide the "Approve Return" button (line ~177) for non-admins. Keep "Cancel Return" visible to the original creator/admin as today.
- **`src/components/warehouse/MaterialIssueDetailsDialog.tsx`** — hide both "Approve as HOD" (line ~440) and "Approve as Management" (line ~467) buttons for non-admins.

Non-admins still see the dialogs and statuses; only the approve actions disappear. Add a small muted note "Only admins can approve" where the button used to be so it's discoverable.

## 3. Server-side enforcement (source of truth)

UI hiding is not enough — the same checks must exist server-side. Add a single SQL migration that:

1. Creates a SECURITY DEFINER helper `public.is_admin_or_higher(_user uuid)` that returns true when the user has role `admin` or `super_admin` in `user_roles` (reuses existing `has_role` pattern).
2. Tightens UPDATE RLS policies on the three tables so transitions into approved states are restricted:
   - `goods_receipt_notes` — UPDATE allowed only when `is_admin_or_higher(auth.uid())` is true OR the row's status is not changing to `approved`/`completed`.
   - `material_return_notes` — UPDATE allowed only when `is_admin_or_higher(auth.uid())` is true OR new status is not `returned`/`approved`.
   - `material_issue_notes` — UPDATE allowed only when `is_admin_or_higher(auth.uid())` is true OR `hod_approved_by` / `management_approved_by` / `status='approved'` are not being set.
3. Same guard added to any existing approval RPCs (`approve_grn`, `approve_material_return`, etc.) by checking `is_admin_or_higher(auth.uid())` at the top and raising `permission denied` otherwise.

Exact policy SQL will be written when the migration is created (uses `OLD`/`NEW` comparison in a row-level trigger because RLS UPDATE policies can't compare to `OLD` directly — implemented as a `BEFORE UPDATE` trigger that raises an exception on unauthorized status transitions, leaving existing RLS in place).

## 4. Verification

- Log in as a non-admin → open a draft GRN/MRN/MIN → approve buttons absent; direct supabase call to flip status to `approved` returns permission error.
- Log in as admin → buttons visible; approval flow works end-to-end as before.

## Technical notes

- "Admins and above" = `admin` + `super_admin`. `moderator` is excluded (confirm if you want moderators included).
- No changes to `useIsAdminOrHigher` so existing delete-permission behavior is unaffected.
- DB trigger approach is preferred over OLD-aware RLS because Postgres RLS `WITH CHECK` clauses can reference `NEW` but not `OLD`; trigger gives clear error messages and centralizes the rule.
