## Goal
Remove the strict `SRN-YYYY-NNNNNN` format requirement when issuing materials (individual via `CreateMaterialIssueDialog` and bulk via `BulkIssueFromInventoryDialog`). Users should be able to type any SRN number (or keep the auto‑generated one) without the form rejecting it.

## Scope
Frontend only. No DB schema, RLS, or RPC changes — there is no DB CHECK constraint on `srn_number`, so removing the client format check is safe. Auto‑generation (`generate_srn_number` RPC) and duplicate‑check (`srn_number_exists` RPC) stay as‑is.

## Changes

1. **`src/components/warehouse/SrnNumberField.tsx`**
   - Drop the `SRN_FORMAT.test(value)` check in `handleBlur`. Keep the duplicate‑existence check.
   - Update `placeholder` from `"SRN-YYYY-NNNNNN"` to a neutral hint like `"Enter SRN number"`.
   - Update helper text to no longer imply a required format ("Auto‑generated. Edit to enter your own number.").
   - Remove the `.toUpperCase()` forced casing on manual input (optional but consistent with "no format").

2. **`src/hooks/useSrnNumber.ts`**
   - Remove the now‑unused `SRN_FORMAT` export (and the import in `SrnNumberField.tsx`).

No changes needed in `CreateMaterialIssueDialog.tsx` or `BulkIssueFromInventoryDialog.tsx` — they already pass the value through; removing field‑level validation is enough.

## Out of scope
- The auto‑generated SRN will still follow `SRN-YYYY-NNNNNN` because that's how `generate_srn_number` produces it server‑side. The user only asked to remove the *required* format, not the generator output. If they want the generator changed too, that's a separate DB migration.