## Problem

Stock is being deducted while MINs are still in `draft`, violating ISO 9001 §8.5.1 (no goods movement before authorised release).

Investigation:

1. `IssueItemsDialog.tsx` ("Issue items" button) runs five client-side steps on whatever MIN is open — **insert `stock_transactions`, run `process_fifo_batch_issue`, run `process_material_issue_stock_update`, update `material_issue_items.issued_at`, then update `material_issue_notes.status='issued'`**. It does **not** check the MIN's status, so it executes on `draft` MINs.
2. After our last migration, the guard trigger `trg_enforce_min_approval_path` blocks the final `draft → issued` transition. The earlier steps already ran, so stock is deducted but the MIN stays `draft`. This matches the rows now in DB: MIN-20260615-008/009/010 are `status='draft'` yet have 3-4 `stock_transactions` each with `reference_type='mrn'`.
3. `BulkIssueFromInventoryDialog` on `/warehouse/inventory` creates a MIN with default status and never calls `submit_material_issue_for_approval`, so its MINs sit in `draft` forever and the "Issue items" button later double-deducts.

## Standard followed

SAP EWM Goods Issue (mvt 261) and ISO 9001 §8.5.1 require:

```text
draft ─► pending_approval ─► approved ─► issued
```

- No `stock_transactions`, no bin allocation changes, no FIFO consumption may happen before `approved`.
- The physical issue posting itself must be **atomic** (all-or-nothing) and **server-side** (cannot be partially executed by a crashed client).
- The issuer (warehouse clerk) must be distinct from the approver where possible, but both actions are logged with identity + timestamp.

## Backend (one migration)

1. **`issue_material(p_min_id uuid)`** — new SECURITY DEFINER RPC. In a single transaction:
   - Load the MIN row `FOR UPDATE`; raise if `status <> 'approved'`.
   - AuthZ: caller must have `admin`, `super_admin`, or warehouse-issuer role for the MIN's company. Reuse `has_role` / `is_min_approver` pattern.
   - For each `material_issue_items` row:
     - Call `process_fifo_batch_issue(...)` (existing).
     - Call `process_material_issue_stock_update(...)` (existing) — this writes `stock_transactions` and adjusts `warehouse_bin_allocations`.
     - Stamp `issued_at = now()`, `quantity_received = 0`.
   - Update MIN: `status='issued'`, `issued_by`, `issued_by_name`, `updated_at`.
   - On any failure the whole transaction rolls back, so stock is never partially deducted.

2. **Extend `trg_enforce_min_approval_path`** to also block direct `approved → issued` updates from outside `issue_material()` (use the same `set_config('app.min_internal','on', true)` guard pattern already used by `approve_material_issue`). This makes client-side stock writes structurally impossible.

3. **Backfill cleanup script** in the migration: for the three known broken MINs (MIN-20260615-008/009/010), either reverse the orphan `stock_transactions` and matching `warehouse_bin_allocations` changes, or flip those MINs to `status='issued'` so the books match the ledger. We will reverse — the MINs were never approved.

## Frontend

1. **`IssueItemsDialog.tsx`** — replace the five client-side steps with one call: `supabase.rpc('issue_material', { p_min_id: issueId })`. Keep the batch-preview UI; remove the manual `stock_transactions.insert`, `process_fifo_batch_issue` loop, `process_material_issue_stock_update` loop, and the final status update.

2. **MIN list (`/warehouse/material-issue`)** — only render the "Issue items" action when `status === 'approved'`. For `draft` / `pending_approval` / `rejected`, the button is hidden or disabled with a tooltip ("Awaiting approval").

3. **`BulkIssueFromInventoryDialog.tsx`** —
   - After `createItems`, call `submitForApprovalAsync(issueNote.id)` (same as `CreateMaterialIssueDialog` already does).
   - Replace the misleading copy: "Stock is deducted from the issue location's bins on submit (SAP-style Goods Issue)" → "Submits a Material Issue Note for admin approval. Stock is deducted only after approval and physical issue."
   - Toast: "MIN … submitted for approval" instead of "Material Issued".

4. **`useMaterialIssues.ts`** — add `issueMaterialAsync` mutation calling the new RPC; invalidate `material-issues`, `warehouse-items`, `warehouse-bin-allocations`, `warehouse-stock-movements`, `warehouse-reservations`, `approval-console`.

## Out of scope

- No changes to material requests or returns.
- No new roles; reuses admin / super_admin / existing warehouse-issuer check.
- "Mark Received" flow downstream of `issued` is unchanged.

## Verification

1. Create a MIN via Bulk Issue → status `pending_approval`, no `stock_transactions` rows, no bin allocation changes.
2. Admin approves → status `approved`, still no stock movement.
3. Issuer clicks "Issue items" → single RPC runs, stock deducted, `stock_transactions` written, status `issued`.
4. Try "Issue items" on a `draft` MIN via direct RPC call → raises `MIN is not approved`.
5. Try `UPDATE material_issue_notes SET status='issued' WHERE status='draft'` from SQL editor → blocked by guard trigger.
6. Re-check MIN-20260615-008/009/010: backfill reversed their orphan stock_transactions; bin balances restored.
