# Draft Workflow for MIN / MRN / GRN

## Goal
Let users create, save, and edit documents as **drafts** before committing them to the formal approval / posting workflow — matching the international standard document lifecycle used in SAP, Oracle, and Microsoft Dynamics:

```text
Draft → Submitted (Pending Approval) → Approved → Posted/Completed
                                    ↘ Rejected → (back to Draft)
                                    ↘ Cancelled
```

Drafts have no stock impact, no ledger entries, no document number consumption (a temporary `DRAFT-####` number is shown until submission), and are visible only to the creator and admins.

## Scope
- **GRN** (`goods_receipt_notes`) — already has `draft` in enum.
- **MIN** (`material_issue_notes`) — already has `draft` in enum.
- **MRN** (`material_return_notes`) — already has `draft` in enum.

No schema migrations required for the status enum; minor additions for draft metadata + RLS only.

## UX Standard
Every create dialog gets a **three-button footer**:

| Button | Action | Status set |
|---|---|---|
| Cancel | Close without saving | — |
| Save as Draft | Persist with minimal validation | `draft` |
| Submit | Full validation + workflow start | `submitted` / `pending_approval` |

Existing list pages get:
- A **Status filter** with a "My Drafts" quick chip.
- A **Draft** badge (amber) and a pencil icon on draft rows that opens the same Create dialog in *edit* mode.
- A **Delete Draft** action (drafts only, creator/admin only — never on submitted docs).

Details dialog for a draft shows a yellow banner: *"This document is a draft. It will not affect stock or approvals until submitted."* with a **Submit for Approval** primary action.

## Technical Design

### 1. Hooks (`useMaterialIssues`, `useMaterialReturns`, `useGoodsReceiptNotes`)
Refactor the create mutation to accept `{ payload, mode: 'draft' | 'submit' }`:
- `draft` → skips required-field guards beyond `company_id`+`created_by`, sets `status='draft'`, **does not** call number generator (uses `null` doc number, UI shows `DRAFT-{shortId}`).
- `submit` → runs full validation, calls existing number generator RPC, sets `status` to the current "new submission" value (`pending_approval` for MIN, `submitted` for GRN, `approved`/workflow-start for MRN per existing logic), and triggers existing side-effects (approval routing, notifications).

Add `submitDraft(id)` mutation that re-runs the submit path on an existing draft row (assigns real doc number, flips status, fires side-effects).

Add `deleteDraft(id)` mutation guarded server-side to `status='draft'` only.

### 2. Dialog components
`CreateMaterialIssueDialog`, `CreateMaterialReturnDialog`, `CreateGrnDialog`:
- Accept optional `draftId` prop → loads existing draft into the form.
- Footer split into `Save as Draft` (secondary) + `Submit` (primary).
- Item lines persist on draft save (already child tables) — child rows tagged with parent's draft id.

### 3. Migration (single small migration)
- Add partial unique guard so draft rows skip the doc-number unique index (use `WHERE status <> 'draft'` on the existing unique indexes for `min_number`, `mrn_number`, `grn_number`).
- Add RLS policy: drafts visible only to `created_by` + company admins; submitted+ rows keep existing visibility.
- Add `delete` policy restricted to `status='draft' AND created_by = auth.uid()` (plus admin override).

### 4. List pages
`MaterialIssueReturn.tsx`, `GoodsReceiptNote.tsx`:
- Add "Drafts" tab / status filter chip.
- Row click on a draft opens Create dialog in edit mode instead of details dialog.

### 5. Approval / stock side-effects
No changes — they already trigger only on the submit/approval transitions, so drafts naturally bypass them.

## Out of Scope (can be follow-ups)
- Auto-save / autosave-on-blur for drafts.
- Draft expiry / cleanup job.
- Extending the same pattern to Material Requests, Stock Transfers, Cycle Counts (same template can be reused later).

## Deliverables
1. One migration (unique-index partial, RLS additions).
2. Updated hooks for MIN / MRN / GRN with `saveDraft`, `submitDraft`, `deleteDraft`.
3. Updated Create dialogs (3) with two-action footer + edit-draft mode.
4. Updated list pages (2) with Drafts filter, edit-on-click for drafts, delete-draft action.
5. Draft banner + Submit action in the 3 Details dialogs.
