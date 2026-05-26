## Goal
Let admins and above create stock transfers as already-approved, skipping the approval queue. Regular users still submit for approval as today.

## Backend
No DB changes. `useCreateStockTransfer` already supports `status: 'approved'` and auto-fills `approved_by`/`approved_date` when passed.

## Frontend changes

**`src/components/warehouse/CreateStockTransferDialog.tsx`**
- Import `useIsAdminOrHigher` (returns `canDelete` flag covering admin/super_admin/moderator — same gate used elsewhere for elevated actions).
- In `onSubmit`, when the current user is admin-or-higher, add `status: 'approved'` to `transferData` so the transfer skips the approval workflow.
- Update the `DialogDescription` text dynamically:
  - Admin+: "Transfer is auto-approved. Mark items as completed to physically move stock."
  - Others: keep current "Creates a transfer request (pending approval)…" text.
- Change submit button label conditionally: "Create & Approve Transfer" (admin+) vs "Submit for Approval" (others). If the current button text is generic ("Create Transfer"), keep that for non-admin and switch admin to "Create & Approve".

## Out of scope
- No change to existing pending-approval records or the Approvals console flow.
- No change to permission to *complete* a transfer (stock movement still happens at completion step).
- Roles allowed: admin, super_admin, moderator (matches `useIsAdminOrHigher`). Confirm if you want a stricter gate (admin/super_admin only).