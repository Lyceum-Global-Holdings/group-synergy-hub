# Multi-file attachments for MIN & MRN

Today MIN (`material_issue_notes`) and MRN (`material_return_notes`) each store **one** SRN file in a single text column (`srn_document_url`). International document-management practice (ISO 15489 records management, GS1 EPCIS evidence packs, SAP/Oracle attachment models) treats supporting evidence as a **1-to-many attachment set** with per-file metadata, audit trail, and category tagging — not a single overwrite-only URL.

## What you'll see in the UI

On both **Create/Edit Material Issue Note** and **Create/Edit Material Return Note** dialogs, the current single-file "SRN Document" block becomes an **Attachments** panel:

- Drag-and-drop zone + "Take photo" + "Choose files" buttons (multi-select enabled).
- List of uploaded files showing: thumbnail/icon, original filename, size, category tag (Signed SRN / Gate Pass / Photo / Delivery Proof / Other), uploader, timestamp.
- Per-row actions: preview, download, replace, remove.
- Up to **10 files** per document, **5 MB** each, types: JPG/PNG/WEBP/PDF (same as today).
- The first uploaded "Signed SRN" remains the primary evidence shown on PDF exports and list views, so existing PDF/print flows don't regress.

## Backend (one migration)

New table `public.material_document_attachments` — generic, parent-typed so MIN, MRN, and future MR can share it:

```text
id uuid pk
parent_type text  check in ('material_issue','material_return','material_request')
parent_id uuid    not null
company_id uuid   not null     -- multi-tenant scope (Core rule)
category text     check in ('signed_srn','gate_pass','photo','delivery_proof','other')
file_path text    not null     -- storage object key
file_name text, mime_type text, file_size bigint
uploaded_by uuid, uploaded_at, created_at, updated_at
index (parent_type, parent_id)
index (company_id, created_at desc)
```

- GRANTs: `authenticated` (SELECT/INSERT/UPDATE/DELETE), `service_role` ALL. No `anon`.
- RLS: company-scoped via `can_access_company(company_id)`; writers must also have edit rights on the parent MIN/MRN (reuse existing helper, mirroring current `srn_document_url` update path).
- Reuses the existing **`min-srn-documents`** storage bucket — no new bucket, no new policies needed; path prefix stays `{company_id}/{parent_id}/...` so current RLS continues to apply.
- **Back-compat:** keep `srn_document_url` column. A trigger keeps it in sync with the latest `signed_srn` attachment so existing PDFs, list columns, and the MR module that read it keep working unchanged. No data migration required for existing rows.

## Frontend

1. **New shared component** `src/components/warehouse/SrnAttachmentsField.tsx` — replaces `SrnDocumentUploadField` usage in MIN and MRN dialogs. Props: `parentType`, `parentId?`, `companyId`, `disabled`. Handles temp-folder uploads when `parentId` is absent and re-parents on save.
2. **New hook** `src/hooks/useMaterialAttachments.ts` — React Query list + upload + delete + category-change mutations, scoped by `(parentType, parentId)`.
3. **Wire-in points** (UI-only edits, no business-logic change):
   - `src/components/warehouse/CreateMaterialIssueDialog.tsx` (and edit dialog if separate)
   - `src/components/warehouse/material-return/...` create/edit dialog
   - Detail views: render the attachment list read-only.
4. Keep the existing `SrnDocumentUploadField` file untouched for now so the MR module and any other consumers keep working; remove it in a later cleanup once all callers migrate.

## Out of scope (intentionally)

- No change to MIN/MRN business logic, approvals, stock movements, or PDF layout beyond swapping the single SRN thumbnail for the primary signed-SRN attachment.
- No new storage bucket; no public access.
- MR (Material Request) module attachments — same pattern can be applied later by passing `parent_type='material_request'`.

## Order of execution

1. Run migration (new table + GRANTs + RLS + sync trigger).
2. After types regenerate: add hook + shared component.
3. Swap component into MIN and MRN create/edit dialogs and detail views.
4. Smoke test: upload 3 files on a new MIN, save, reopen, delete one, confirm `srn_document_url` reflects the latest signed SRN.
