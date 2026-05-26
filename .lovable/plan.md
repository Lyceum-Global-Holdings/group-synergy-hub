## Goal
Let users attach a photo or scanned file of the signed SRN to material requests, individual issues, bulk issues, and material returns. Individual issue already has this — extend it to the other three surfaces using the existing `SrnDocumentUploadField` and `min-srn-documents` storage bucket.

## Backend
Add the storage column to the two tables that don't have it yet:

```sql
ALTER TABLE public.material_requests     ADD COLUMN IF NOT EXISTS srn_document_url text;
ALTER TABLE public.material_return_notes ADD COLUMN IF NOT EXISTS srn_document_url text;
```

No new bucket, no new RLS — the existing `min-srn-documents` bucket and its company-scoped storage policies already cover all three header tables (policies key off `company_id` as the first folder segment).

## Frontend
Reuse `SrnDocumentUploadField` (already supports JPG/PNG/WEBP/PDF, camera capture, 5MB cap, signed URL preview). Wire it in next to the SRN number field, using the same "upload to `temp/`, then move/update path after insert" pattern as `CreateMaterialIssueDialog`:

- **`BulkIssueFromInventoryDialog.tsx`** — add field; after MIN insert, persist path via `update({ srn_document_url })` on `material_issue_notes`.
- **`CreateMaterialRequestDialog.tsx`** — add field; after request insert, persist on `material_requests`.
- **`CreateMaterialReturnDialog.tsx`** — add field; after return insert, persist on `material_return_notes`.

Generalise `SrnDocumentUploadField` so `persistOnChange` works for any of the three tables: add a `table` prop (`'material_issue_notes' | 'material_requests' | 'material_return_notes'`, default `material_issue_notes` to preserve current behavior). Rename `minId` → `recordId` (keep `minId` as deprecated alias to avoid breaking existing call sites).

## Display
Show the attached document in the existing details dialogs when present:
- `MaterialIssueDetailsDialog` — already shows it (no change).
- `MaterialRequestDetailsDialog` / `MaterialReturnDetailsDialog` — render `SrnDocumentUploadField` in read-only mode (disabled) bound to the record's `srn_document_url`.

## Types
Extend `src/types/materialIssueReturn.ts` to add `srn_document_url?: string | null` on `MaterialRequest` and `MaterialReturnNote`. `src/integrations/supabase/types.ts` regenerates automatically after the migration.

## Out of scope
- No change to SRN number validation (already removed previously).
- No bulk-history viewer changes beyond the details dialogs above.
- File size/type rules stay as today (5MB, JPG/PNG/WEBP/PDF).
