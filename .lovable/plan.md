## Goal
Let an admin reject a submitted GRN with a structured, internationally-recognised reason (ISO 9001 §8.7 *Control of nonconforming outputs* + GS1 CBV `Disposition` vocabulary + SAP MIGO MVT 122 rationale). Rejection is a terminal status — it stops stock from being received, leaves an audit trail, and is enforced server-side just like approval.

## Reason code catalogue
Stored as a Postgres enum `grn_rejection_reason`. Names map to widely-used international codes so the data is portable.

| Code | Label | International basis |
| --- | --- | --- |
| `damaged_in_transit` | Damaged in transit | GS1 CBV `damaged` |
| `quantity_short` | Short quantity received | ISO 9001 §8.7; SAP MIGO short delivery |
| `quantity_over` | Over-delivered quantity | SAP MIGO over delivery |
| `wrong_item` | Wrong item / spec mismatch | ISO 9001 NCR |
| `quality_failure` | Failed quality inspection | ISO 9001 §8.7; GS1 `non_sellable_other` |
| `expired_or_near_expiry` | Expired / shelf-life breach | GS1 `expired` |
| `missing_documentation` | Missing invoice/COA/packing list | INCOTERMS 2020 doc compliance |
| `late_delivery` | Outside agreed delivery window | OTIF KPI |
| `packaging_non_conformance` | Packaging non-conformance | GS1 packaging guidelines |
| `supplier_non_conformance` | Supplier non-conformance (other) | ISO 9001 §8.4 |
| `other` | Other (free text required) | — |

## Database changes (single migration)
1. `CREATE TYPE public.grn_rejection_reason AS ENUM (...)` with the codes above.
2. `ALTER TABLE public.goods_receipt_notes`
   - add `rejection_reason grn_rejection_reason`
   - add `rejection_notes text`
   - add `rejected_by uuid REFERENCES auth.users(id)`
   - add `rejected_date timestamptz`
3. Extend the GRN status text values to include `'rejected'` (the column is already free-text; no enum change needed) and add a CHECK or trigger guard: `status = 'rejected'` ⇒ `rejection_reason IS NOT NULL`; `other` ⇒ `rejection_notes IS NOT NULL AND length(trim(rejection_notes)) > 0`.
4. New trigger `enforce_grn_admin_rejection()` mirroring `enforce_grn_admin_approval()` — only `admin`/`super_admin` (via existing `is_admin_or_higher`) may transition into `rejected`, and only from `submitted`. Re-approval after rejection is blocked.
5. New SECURITY DEFINER RPC `reject_goods_receipt_note(_grn_id uuid, _reason grn_rejection_reason, _notes text)` that performs the update atomically, sets `rejected_by = auth.uid()`, `rejected_date = now()`, and returns the updated row. Grant `EXECUTE` to `authenticated`.

## Frontend changes
- `src/types/grn.ts` — add `'rejected'` to `GrnStatus`; add `GrnRejectionReason` union matching the enum; add `REJECTION_REASON_LABELS` map.
- `src/hooks/useGoodsReceiptNotes.ts` — new `useRejectGoodsReceiptNote` mutation calling the RPC; invalidates the GRN list + detail caches.
- `src/components/warehouse/GrnDetailsDialog.tsx`
  - Add red bg badge for `rejected` in `statusColors`/`statusLabels`.
  - When `status === 'submitted'` and `isAdmin`, render a destructive **Reject GRN** button alongside **Approve GRN**.
  - Clicking opens a new lightweight `RejectGrnDialog` (created in the same folder) with: a Select bound to the reason catalogue, a Textarea for notes (required when `other`, optional otherwise), Cancel / Confirm Rejection (destructive variant). Confirm calls the mutation; on success closes both dialogs and toasts.
  - When a GRN is already `rejected`, show the reason + notes + who/when in the Details tab (read-only panel).
- `src/pages/warehouse/GoodsReceiptNote.tsx` — make sure the status filter dropdown and any badge colour map include `rejected` so the list view reflects the new state.

## Out of scope
- No changes to the bin-allocation dialog or stock movement code paths — rejection deliberately bypasses inventory side-effects.
- No notification/email plumbing in this change (can be added later via the existing `send-approval-notification` edge function).
- No bulk-reject UI; one GRN at a time.
