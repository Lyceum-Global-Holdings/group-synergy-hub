## Goal

Let creators edit their own MIN/MRN/GRN drafts (header + line items) and resubmit them for approval, following SAP/Oracle/D365 norms: drafts are mutable by the owner, locked once submitted, and rejected documents return to `draft` for rework.

## Standards alignment

- **SAP MM / Oracle iProcurement / D365 SCM**: Documents in `Draft` are fully editable by the creator. Once submitted, the document is locked (read-only) pending approval. On **Reject**, the document is sent back to `Draft` with the rejection reason persisted, and the creator may revise + resubmit. Approved/Posted documents are immutable (only reversal allowed). ISO 9001 §8.5.1 segregation of duties is preserved: edits never touch stock — stock movement only happens at approval.

## Lifecycle (unchanged states, clarified transitions)

```text
Draft ──edit──► Draft
Draft ──submit──► Pending Approval ──approve──► Approved/Posted
                                  └─reject──► Draft (with reason)
Draft ──cancel/delete──► (gone)
```

## Scope

In scope: MIN, MRN, GRN — header edits, line add/update/remove, resubmit, reopen-on-reject. Out of scope: edits after approval, audit-trail UI redesign, auto-save, version history (DB already stamps `updated_at`).

## Frontend changes

1. **`CreateMaterialIssueDialog` / `CreateMaterialReturnDialog` / GRN create dialog**
   - Accept optional `editingDraft` prop. When present:
     - Title becomes "Edit Draft — {doc number or DRAFT-xxx}".
     - Pre-fill header form + existing line items via existing hooks.
     - On `Save as Draft` → call update hook (not create) to upsert header + replace child rows in a transaction-style flow (delete removed lines, update existing, insert new).
     - On `Submit for Approval` → same update flow, then call existing `submitForApprovalAsync(id)`.
   - Buttons disabled when status ≠ `draft`.

2. **List pages (`MaterialIssueReturn.tsx`, `MaterialReturn` page, `GoodsReceiptNote.tsx`)**
   - Row click on a `draft` row opens the create dialog in edit mode (instead of the read-only details dialog).
   - Add an "Edit Draft" action in the row menu for clarity.
   - Keep existing "Delete Draft" action.

3. **Details dialogs (MIN/MRN/GRN)**
   - When status = `draft`: show banner "This is a draft. [Edit] [Submit for Approval] [Delete]".
   - When status = `rejected`: show rejection reason banner + "Reopen as Draft" button (calls a new hook that flips status back to `draft`, clears `approved_by`/`approved_date`, preserves rejection reason in notes/audit).

## Backend changes

1. **Hooks (`useMaterialIssues`, `useMaterialReturns`, `useGoodsReceiptNotes`)**
   - Add `updateDraftAsync({ id, header, items })` that:
     - Verifies row is still in `draft` (guard against race with approver).
     - Updates header columns.
     - Reconciles `*_items` child table: delete removed, update changed, insert new — all scoped by parent id.
   - Add `reopenRejectedAsync(id)` for MIN/MRN/GRN that calls a new RPC.

2. **Child-item hooks**
   - Already support insert; add `replaceItemsForParent(parentId, items[])` helper that wraps delete-missing + upsert-present.

3. **DB migration**
   - RLS: tighten `UPDATE` on `material_issue_notes`, `material_return_notes`, `goods_receipt_notes` and their `*_items` tables so non-admin users can update **only** when `status = 'draft'` AND `created_by = auth.uid()`. Admins/approvers keep full update rights for status transitions.
   - Three new SECURITY DEFINER RPCs: `reopen_material_issue_draft(p_min_id)`, `reopen_material_return_draft(p_mrn_id)`, `reopen_grn_draft(p_grn_id)` — allowed only when current status is `rejected` and caller is `created_by` or admin; sets status back to `draft`, nulls approver fields, appends rejection reason to internal notes, logs to existing audit table.
   - Confirm partial unique index already excludes drafts from doc-number uniqueness (added in prior draft migration); extend to GRN/MRN if missing.

## Technical notes

- Line reconciliation runs client-side via 3 supabase calls (delete by id-not-in, update by id, insert new) because Supabase has no client-side transaction; an RPC wrapper is optional follow-up if race conditions appear.
- No new statuses, no new tables — purely policy + RPC + UI wiring.
- Stock impact remains gated by existing `approve_*` RPCs; edits never write to `warehouse_bin_allocations` or `stock_transactions`.

## Deliverables

- 1 migration (RLS tightening + 3 reopen RPCs).
- Updated `useMaterialIssues`, `useMaterialReturns`, `useGoodsReceiptNotes` with `updateDraftAsync` + `reopenRejectedAsync`.
- 3 create dialogs gain edit-mode support.
- 3 list pages route draft clicks to edit dialog; details dialogs gain Edit / Reopen buttons.

---

## Implementation Status

**Shipped (MIN + MRN + GRN edit-mode, end-to-end):**

- **MIN**:
  - `useMaterialIssueItems.replaceItemsForMinAsync` (delete + reinsert draft lines).
  - `useMaterialIssues.updateMaterialIssueAsync` exposed.
  - `CreateMaterialIssueDialog` accepts `editingDraft`; pre-fills header + lines, retitles, status-still-draft guard, Save Changes / Submit for Approval.
  - List page: Pencil "Edit" button on draft rows + `MaterialIssueDetailsDialog` "Edit Draft" banner.

- **MRN**:
  - `useMaterialReturns.updateDraftWithItemsAsync` (status guard, header update, delete + reinsert items).
  - `CreateMaterialReturnDialog` accepts `editingDraft`; locks Return Type + Source MIN, hydrates header + existing line quantities for internal flows (merges with `get_min_returnable_lines` so `remaining` = rpc + saved-qty, letting the user increase up to the true cap), hydrates supplier items via two-step item-master lookup, Save Changes button.
  - List page: Pencil "Edit" button on draft rows + `MaterialReturnDetailsDialog` "Edit Draft" button.

- **GRN**:
  - `useUpdateDraftGrnWithItems` (status guard, header update, delete + reinsert items, optional submit transition).
  - `CreateGrnDialog` accepts `editingDraft`; hydrates form + line items, gates the PO auto-loader so it doesn't clobber the saved lines on first render (changes to PO mid-edit still load normally), retitles, supports Save Changes and Submit for Approval (writes draft → submitted in one shot).
  - List page actions split into Eye + Pencil; `GrnDetailsDialog` gains "Edit Draft" button next to Submit/Delete.

**Known limitations / follow-up:**
- MRN internal edit assumes `get_min_returnable_lines.qty_returned_prev` includes draft items; if the RPC excludes drafts the `remaining + saved_qty` adjustment double-counts. Verify against live data.
- Line reconciliation is client-side (delete + reinsert in two calls). If concurrent-edit races appear, wrap each module's update in a SECURITY DEFINER `replace_draft_*` RPC.
- Editing a MIN/GRN draft does not re-validate against stock availability — that happens at approval time, which is consistent with SAP/Oracle/D365 norms.

