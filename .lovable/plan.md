# Admin Approval for Material Issue Notes

Today, clicking **Create** on a MIN immediately writes `material_issue_items` AND deducts stock via `process_material_issue_stock_update`. There is no segregation of duties — the requester is also the issuer. This violates ISO 9001 §8.5.1 (control of production / service provision) and ISO 27001 A.5.3 (segregation of duties).

## Standard we follow

**SAP EWM / MIGO movement type 261 (Goods Issue for Order)** and **ISO 9001 §8.5.1** both require:
1. A documented *request* (created by anyone with permission).
2. An *approval* by an authorised role (independent of requester) before any stock movement.
3. The *physical issue* posting (stock deduction) happens only after approval, and is itself logged with approver identity + timestamp for the audit trail.

We will mirror this with a 3-state lifecycle:

```text
draft ─► pending_approval ─► approved ─► issued
                │                │
                └─► rejected ◄───┘
```

- Stock is **never** moved in `draft` or `pending_approval`.
- Only `admin` (and `super_admin`) can move `pending_approval → approved` or `→ rejected`.
- Stock deduction (`process_material_issue_stock_update`) runs **inside the approval RPC**, atomically. Same guard pattern already used by `approve_grn_with_allocations` (see GRN approval memory).
- Requester cannot self-approve (enforced server-side: `approved_by != created_by`).

## Backend (one migration)

1. Extend `material_issue_status` enum / check to include `pending_approval` and `rejected` (keep existing values for backward compat).
2. Add columns to `material_issue_notes` if missing: `submitted_at`, `submitted_by`, `rejected_by`, `rejected_at`, `rejection_reason`. `approved_by` / `approved_date` already exist.
3. New RPC `submit_material_issue_for_approval(p_min_id uuid)` — flips `draft → pending_approval`, stamps `submitted_by/at`, validates company scope.
4. New RPC `approve_material_issue(p_min_id uuid)`:
   - Auth check: caller must have `admin` or `super_admin` role for the MIN's company (via `has_role`).
   - Self-approval guard: reject if `auth.uid() = created_by`.
   - Status check: must be `pending_approval`.
   - For each `material_issue_items` row, run the existing stock deduction logic that today lives in `useMaterialIssueItems.ts` (reservation update + `process_material_issue_stock_update`). Move that orchestration into SQL so it is transactional.
   - On success: status → `approved`, stamp `approved_by/approved_date`. A separate "Mark Issued" action (existing) can later flip to `issued` when physically handed over.
   - On any failure: raise, transaction rolls back, MIN stays in `pending_approval`.
5. New RPC `reject_material_issue(p_min_id uuid, p_reason text)` — admin only, status → `rejected`, stamps reason.
6. **Guard trigger** `enforce_min_approval_path` on `material_issue_notes`: block any `UPDATE` that sets `status='approved'` outside the RPC, mirroring `enforce_grn_allocation_on_approval`.
7. RLS: requesters can SELECT/INSERT own MINs in draft; only admins can call the approve/reject RPCs (SECURITY DEFINER, internal role check).
8. Register in `get_approval_console` so pending MINs appear in `/management/approvals`. Add `'material_issue'` to `ApprovalType` union.

## Frontend

1. **`useMaterialIssueItems.ts`** — remove the client-side stock deduction loop. Items are still inserted on create, but stock movement now lives in `approve_material_issue` RPC.
2. **`useMaterialIssues.ts`** — add `submitForApproval`, `approveMaterialIssue`, `rejectMaterialIssue` mutations that call the new RPCs; invalidate `material-issues`, `warehouse-items`, `warehouse-bin-allocations`, `warehouse-stock-movements`, `approval-console`.
3. **`CreateMaterialIssueDialog.tsx`** — final button changes from "Create" to **"Submit for approval"**. On success the MIN is created in `pending_approval` (not `draft`) so it shows in the admin queue immediately. Existing reset/close behaviour kept.
4. **MIN list page** (`/warehouse/material-issue`) — add a Status column with badge colours; row actions:
   - `pending_approval` + admin: **Approve** / **Reject** buttons (reject opens reason dialog).
   - `pending_approval` + non-admin: read-only "Awaiting approval" pill.
   - `approved`: existing "Mark Issued" action becomes enabled.
   - `rejected`: read-only with reason tooltip.
5. **Approval Console** (`/management/approvals`) — MIN entries surface automatically via `get_approval_console`; `ApprovalCard` routes to the MIN details dialog via `view_url`.
6. **`GrnDetailsDialog`-style audit strip** added to `MaterialIssueDetailsDialog`: Created → Submitted → Approved/Rejected with names + timestamps.

## Out of scope

- No changes to material *requests* (`material_request_*`) or material *returns*.
- No new role; reuses existing `admin` / `super_admin` from `user_roles`.
- "Mark Issued" / "Receive" steps unchanged.
- No email/Telegram notifications in this change (admins see it in Approval Console). Can be added later via existing `send-approval-notification` edge function.

## Verification

1. Non-admin creates MIN → status `pending_approval`, no stock change in `warehouse_bin_allocations` / `stock_transactions`.
2. Admin opens `/management/approvals` → MIN appears; clicks Approve → stock deducted, status `approved`, ledger row written.
3. Requester tries to approve own MIN → RPC returns permission error.
4. Admin rejects with reason → status `rejected`, no stock change, reason visible in details dialog.
5. Direct `UPDATE material_issue_notes SET status='approved'` from SQL editor → blocked by guard trigger.
