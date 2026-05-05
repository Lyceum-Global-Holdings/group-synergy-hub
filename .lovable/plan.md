## Goal

Allow users to attach a photo/scan of the signed SRN (Stock Requisition Note) when creating or viewing a Material Issue Note (MIN). This provides documentary evidence for stock issues — aligned with ISO 9001 (record control), SOX, and SAP MM 261 audit-trail standards (signed requisition retained as the source document).

## Solution Overview

1. **Private Supabase Storage bucket** `min-srn-documents` — company-scoped paths, RLS-protected.
2. **New column** `srn_document_url` on `material_issue_notes` (nullable text, stores object path).
3. **Reusable component** `SrnDocumentUploadField` — photo/PDF upload with preview, download, replace, remove.
4. **Integration** in `CreateMaterialIssueDialog` (during creation) and `MaterialIssueDetailsDialog` (view + later-stage upload/replace, gated by permissions).

## Technical Details

### Storage bucket (migration)
- `id = 'min-srn-documents'`, `public = false`.
- Path convention: `{company_id}/{min_id_or_temp}/srn_{timestamp}.{ext}`.
- RLS on `storage.objects`:
  - SELECT/INSERT/UPDATE/DELETE allowed when `auth.uid()` has access to the company encoded in the first path segment, via existing `can_access_company(company_id)` helper.
  - Admin role bypass via `has_role(auth.uid(), 'admin')`.

### Schema migration
```sql
ALTER TABLE material_issue_notes
  ADD COLUMN srn_document_url text;
COMMENT ON COLUMN material_issue_notes.srn_document_url IS
  'Storage path in min-srn-documents bucket. Photo/scan of signed SRN — audit evidence.';
```
Update TypeScript types in `src/types/materialIssueReturn.ts` (`MaterialIssueNote`, create/update payloads).

### Component: `src/components/warehouse/SrnDocumentUploadField.tsx`
Props: `{ minId?: string; companyId: string; currentDocumentUrl?: string; onUpload: (path: string) => void; disabled?: boolean }`.
- Accepts `image/jpeg, image/png, image/webp, application/pdf`. Max 5 MB.
- Camera capture enabled on mobile via `<input type="file" accept="image/*" capture="environment">` plus a separate "Choose file" button for gallery/PDF.
- Generates path: `${companyId}/${minId ?? 'temp'}/srn_${Date.now()}.${ext}`.
- Uses `supabase.storage.from('min-srn-documents').upload/createSignedUrl/remove`.
- Preview: thumbnail for images via signed URL (60s); icon + filename for PDFs; download and remove actions.
- After successful upload when `minId` exists, also patches `material_issue_notes.srn_document_url`.
- Form-level integration: when MIN is created, the upload happens against `temp/`, then on insert success the file is moved (`storage.move`) into `${companyId}/${newMinId}/...` and the column updated.

### CreateMaterialIssueDialog
- Add field below the SRN Number input (line ~390 area) labeled "SRN Document (photo/scan)".
- Track `srnDocumentTempPath` in state; include in insert payload after move.

### MaterialIssueDetailsDialog
- Show preview of attached SRN doc; allow upload/replace if MIN status is editable and user has `warehouse.material_issue.update` (or admin).
- Read-only download button for users with view permission.

### International-standards compliance
- Private bucket + RLS = confidentiality (ISO 27001 A.8).
- Immutable timestamped filenames + retained audit trail in `stock_transactions` (already linked via `reference_id`) = traceability (ISO 9001 §7.5, SOX §404).
- Signed URLs (short TTL) for downloads = least-privilege access.

## Files to change

- New: `supabase/migrations/<ts>_min_srn_document_storage.sql` (bucket + policies + column).
- New: `src/components/warehouse/SrnDocumentUploadField.tsx`.
- Edit: `src/components/warehouse/CreateMaterialIssueDialog.tsx`.
- Edit: `src/components/warehouse/MaterialIssueDetailsDialog.tsx`.
- Edit: `src/types/materialIssueReturn.ts` (add `srn_document_url`).

## Out of scope
- OCR of SRN photo (can be a future enhancement using Lovable AI).
- Multi-page document assembly (single file per MIN; replace to update).
