## Goal

Let admins add **File Upload** fields to the public Supplier Registration form via the Form Builder, and let suppliers attach documents (BR, tax certs, ISO certs, bank letters, etc.) when registering.

## Industry-standard approach

- Direct-to-storage upload from the public form using a **short-lived signed upload URL** (no service-role key in the browser, no oversized base64 in JSON payloads).
- **Server-side validation** of MIME, size, and extension against a whitelist (PDF, JPG, PNG, DOCX, XLSX) before finalizing the registration.
- **Anti-virus / abuse protection**: enforce per-file size cap (10 MB) and per-submission count cap (max 10 files), reuse existing Turnstile + rate limiter on `public-supplier-registration`.
- Files stored in the existing **private `supplier-documents` bucket** under `pending/{registration_id}/{field_key}/{uuid}-{filename}`. Approval moves/links them to the supplier record (already supported by `supplier_documents` table).
- Schema captures file metadata (`{ path, name, size, mime, uploaded_at }`) inside `supplier_data[field_key]` so it survives the existing JSONB pipeline without DB migrations.
- Multiple files supported per field (configurable: single vs multi).

## Changes

### 1. Schema (`src/lib/supplierFormSchema.ts`)
- Add `"file"` to `SupplierFieldType`.
- Extend `SupplierField` with optional `accept?: string[]` (mime whitelist), `maxSizeMB?: number`, `multiple?: boolean`, `maxFiles?: number`.
- Defaults: `accept = ["application/pdf","image/jpeg","image/png"]`, `maxSizeMB = 10`, `multiple = false`, `maxFiles = 1`.

### 2. Form Builder (`src/components/sourcing/registration/FormBuilder.tsx`)
- Add **"File upload"** to `FIELD_TYPES`.
- In `AddFieldDialog`, when `type === "file"` show: allowed types (multi-select chips: PDF, Image, Word, Excel), max size (number, default 10 MB), allow multiple (switch), max files (number, default 1).

### 3. Renderer (`src/components/sourcing/registration/DynamicSupplierForm.tsx`)
- New `FileUploadField` subcomponent:
  - Uses shadcn Input `type="file"` styled as a drop zone with file list, remove button, progress bar.
  - Client-side validates MIME + size before upload, shows inline error.
  - Calls new edge function `supplier-upload-sign` to get a signed upload URL, then `PUT`s file directly to Supabase Storage.
  - Stores returned `{ path, name, size, mime }` in form state.
- In preview mode, the field is read-only (no actual upload).

### 4. New edge function `supplier-upload-sign`
- Public (`verify_jwt = false`), Turnstile-verified, rate-limited (e.g. 30 sign requests / hour / IP).
- Input (zod): `company_slug`, `field_key`, `filename`, `mime`, `size`.
- Validates: company exists (via `resolve_public_portal_company`), field exists in published schema and is type `file`, mime in field's `accept`, size ≤ field's `maxSizeMB`.
- Generates path `pending/{uuid}/{field_key}/{uuid}-{safeName}` and returns `supabase.storage.from('supplier-documents').createSignedUploadUrl(path)` plus the final path.
- Uses service-role key (server only).

### 5. Edge function `public-supplier-registration` (existing)
- Extend `supplierDataSchema`: allow file values shaped as `{ path: string, name: string, size: number, mime: string }` or arrays thereof.
- After validation, for every file value: HEAD-check object exists in `supplier-documents` and insert a row into `supplier_documents` (document_type = field_key, file_url = path, file_size, file_name) linked to the new `registration_request_id`.
- Reject submission if any referenced object is missing.

### 6. Storage policy (`supplier-documents` bucket)
Migration to add anon INSERT only via signed URL (already the case) and tighten:
```sql
-- Anyone with a signed upload URL can upload to pending/* (signed URL already gates this)
-- Ensure no anon SELECT; only authenticated company users can read via existing policies.
```
Confirm bucket stays private. Add `allowed_mime_types` and `file_size_limit = 10485760` to the bucket if not already set.

## Out of scope
- Virus scanning (note in docs; can be added via a follow-up edge trigger).
- Migrating files from `pending/` to a per-supplier folder on approval (existing approval flow already references `supplier_documents` rows; a small follow-up can rename if needed).
- Changes to authenticated internal supplier creation wizard.

## Verification
1. In Form Builder, add a "Business Registration Certificate" file field (PDF/JPG/PNG, 10 MB, single).
2. Publish, open `/register-supplier?c=<slug>`, upload a PDF, submit.
3. Confirm `supplier_registration_requests.supplier_data` contains `{ path, name, size, mime }`, and a row exists in `supplier_documents` pointing to that path.
4. Try uploading a 20 MB file → rejected client-side and server-side.
5. Try uploading `.exe` → rejected.
