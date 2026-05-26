## Problem

Clicking **Confirm Receipt** in the Receive Items dialog returns `PGRST116 — 0 rows` and the toast "Failed to receive items". As a side effect, the downstream stock movements/status that depend on `quantity_received` never get written, so stock figures never settle.

Root cause is in Row-Level Security, not the dialog code:

- `material_issue_notes` UPDATE policy only allows:
  - admins, OR
  - the creator while `status = 'draft'`.
- `material_issue_items` ALL policy mirrors the same rule.

By the time someone receives an issue, the note is already in `status = 'issued'`, so the UPDATE returns 0 rows and `.single()` throws. Non-admin receivers can never close the loop.

## Fix

Tighten the RLS so the receiving flow works for legitimate users without weakening draft-edit protection.

### Migration (single migration)

1. Drop and recreate the UPDATE policy on `public.material_issue_notes`:
   - Admins: full update (unchanged).
   - Creator while `status = 'draft'`: full update (unchanged).
   - Any user with `can_access_company(company_id)` may update **only** when the note is in a receivable state (`status IN ('issued','partially_received')`). This is what `ReceiveItemsDialog` needs to flip status to `partially_received` / `completed` and stamp `received_by`, `received_by_name`, `received_date`, `order_completed`.

2. Drop and recreate the ALL policy on `public.material_issue_items` to mirror the same logic, so `quantity_received` / `received_at` updates succeed for receivers in the same company. INSERT/DELETE remain limited to creators-in-draft and admins.

3. Keep all other policies (SELECT, INSERT, DELETE) unchanged.

No schema columns are added. No trigger changes. The `trigger_update_material_issue_note_receipt_status` trigger and any existing stock-movement logic continue to run on the now-successful UPDATEs.

### Why this is safe

- Draft editing stays locked to creator + admins.
- Receiving is a company-scoped operation gated by `can_access_company`, the same predicate already used for SELECT.
- No code changes in `ReceiveItemsDialog.tsx` are needed — once RLS allows the UPDATE, the existing flow (`quantity_received` per item → note status → optional auto-MRN → cache invalidation) completes and stock reconciles.

## Out of scope

- Changing how/when stock is deducted (issue-time vs receive-time logic stays as-is).
- UI changes to the Receive Items dialog.
- SRN validation or attachments.

## Verification

After the migration, retry the failing flow on `MIN-20260526-002`:
- Receive succeeds, toast shows success.
- Note status flips to `completed`, `received_by/date` populated.
- Stock-related queries (`warehouse-items`, `stock-transactions`) reflect the receipt.
