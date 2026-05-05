# Stores Requisition Note (SRN) — Implementation Plan

Adds a first-class **Stores Requisition Note (SRN)** reference across the Material Issue & Return module, aligned with international stores-management standards (ISO 9001 traceability, GS1-style document referencing, and SAP/Oracle MM conventions where the SRN is the originating stores requisition that authorises a goods issue).

## Standard followed

- **SRN** is the formal stores requisition raised by the requesting department/site that authorises issue of stock — it is the *source document* for the MIN.
- Numbering format: `SRN-{YYYY}-{NNNNNN}` (year-scoped sequence per company), matching the existing MIN/MRN pattern.
- Captured at header level on Request / MIN / MRN, plus optional per-line override (when one MIN consolidates lines from multiple SRNs — common in multi-site issues).
- Unique per company; manual override allowed for back-dated or external SRNs (e.g. paper-based site requisitions being digitised), with uniqueness validation.

## Database changes (migration)

1. **New columns** (all nullable text, default NULL):
   - `material_requests.srn_number`
   - `material_issue_notes.srn_number`
   - `material_return_notes.srn_number`
   - `material_issue_items.srn_number` (per-line override)
   - `material_request_items.srn_number` (per-line override)

2. **Sequence + generator function**
   - Postgres function `generate_srn_number(_company_id uuid)` returning `SRN-YYYY-NNNNNN`, using a per-company yearly counter table `srn_counters(company_id, year, last_seq)` with row-level locking — same pattern already used for MIN/MRN.

3. **Uniqueness constraint**
   - Partial unique index on `(company_id, srn_number)` where `srn_number IS NOT NULL` for each of the three header tables.

4. **Indexes** for lookups: `(company_id, srn_number)` btree on each header table.

5. **Validation trigger** (not CHECK) on each header table: rejects duplicates within the same company; format-validates `^SRN-\d{4}-\d{6}$` when manually entered.

## Type changes

Extend `src/types/materialIssueReturn.ts`:
- Add `srn_number: string | null` to `MaterialRequest`, `MaterialIssueNote`, `MaterialReturnNote`, `MaterialIssueItem`, `MaterialRequestItem`.
- Add optional `srn_number?: string` to all `Create*Data` interfaces.

## UI changes

1. **Reusable component** `src/components/warehouse/SrnNumberField.tsx`
   - Label: *"SRN Number (Stores Requisition Note)"*.
   - Auto-fills via `useGenerateSrnNumber()` hook (calls RPC) when dialog opens; user can clear and type their own.
   - Inline "Regenerate" button + "Manual" toggle.
   - Validates uniqueness on blur via lightweight RPC `srn_number_exists(company_id, srn_number, exclude_id)`.
   - Shows badge "Auto" or "Manual" beside the field.

2. **Dialogs updated**:
   - `CreateMaterialRequestDialog` — header SRN field.
   - `CreateMaterialIssueDialog` — header SRN field; line-item editor gains optional SRN override column.
   - `CreateMaterialReturnDialog` — header SRN field (links return back to originating SRN).

3. **Details dialogs** (`MaterialRequestDetailsDialog`, `MaterialIssueDetailsDialog`, `MaterialReturnDetailsDialog`) — display SRN as a labeled metadata row with copy-to-clipboard.

4. **List columns** (`MaterialIssueReturn.tsx`) — add an "SRN #" column to all three tables, rendered as a `Badge variant="outline"` (matches existing CPO column treatment).

## Hook / API changes

- `src/hooks/useSrnNumber.ts` — `useGenerateSrnNumber()` (mutation calling RPC) + `useSrnExists()` (debounced query).
- Update `useMaterialIssues`, `useMaterialReturns`, `useMaterialRequests` selects to include `srn_number`.
- Create mutations: pass SRN through, normalising empty string → null per project memory rule.

## Search & reporting

- Add SRN to the global search filter on each tab (text input above the DataTable) so users can locate documents by SRN number.
- SRN is included as a column in the existing CSV/PDF exports of these lists.

## Out of scope

- A separate "SRN module" with its own list view (current scope treats SRN purely as a reference/traceability field). If desired later, the schema is structured to support promoting it to its own entity without migration churn.

## Files affected (approx.)

```text
supabase/migrations/<new>_add_srn_tracking.sql        (new)
src/types/materialIssueReturn.ts                       (edit)
src/hooks/useSrnNumber.ts                              (new)
src/hooks/useMaterialIssues.ts                         (edit – select + create)
src/hooks/useMaterialReturns.ts                        (edit)
src/hooks/useMaterialRequests.ts                       (edit)
src/components/warehouse/SrnNumberField.tsx            (new)
src/components/warehouse/CreateMaterialRequestDialog.tsx   (edit)
src/components/warehouse/CreateMaterialIssueDialog.tsx     (edit)
src/components/warehouse/CreateMaterialReturnDialog.tsx    (edit)
src/components/warehouse/MaterialRequestDetailsDialog.tsx  (edit)
src/components/warehouse/MaterialIssueDetailsDialog.tsx    (edit)
src/components/warehouse/MaterialReturnDetailsDialog.tsx   (edit)
src/pages/warehouse/MaterialIssueReturn.tsx            (edit – columns)
```

Approve to implement.
