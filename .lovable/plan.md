# Add Approved By + MRN Upload to Create Asset Request

## Scope
Extend the Create Asset Request dialog (`src/components/warehouse/asset-requests/CreateAssetRequestDialog.tsx`) with two new inputs:
1. **Approved By** – free-text field capturing the name of the person who pre-approved the request (separate from the system HOD approval workflow that fires after submission).
2. **MRN Copy** – file upload (PDF/image) for the Material Requisition Note document, stored in Supabase Storage and linked to the request.

## Database changes (migration)
Add to `public.asset_requests`:
- `approved_by_name text` – name entered on the form.
- `mrn_document_url text` – public/signed URL of uploaded MRN copy.
- `mrn_document_path text` – storage object path (for deletion / re-signing).

Create a private storage bucket `asset-request-documents` with RLS policies:
- Authenticated users in the same company can read.
- Authenticated users can upload to their company's folder (`{company_id}/...`).
- Owners / admins can delete.

## UI changes
In `CreateAssetRequestDialog.tsx`:
- Add `approvedBy` state + Input (placed next to Priority, in the header grid).
- Add `mrnFile` state + a file picker (accept `.pdf,image/*`) with selected-file name preview and a clear button. Place below Justification under a new "MRN Copy" label.
- On submit:
  1. If `mrnFile` is set, upload to `asset-request-documents/{company_id}/{timestamp}-{filename}` using `supabase.storage`.
  2. Capture returned `path` and a signed URL (1 year) → pass `mrn_document_url` and `mrn_document_path` into the insert payload.
  3. Include `approved_by_name` in the insert payload.
- Reset both fields after successful submission.

## Hook / type updates
- `src/hooks/useAssetRequests.ts` – extend the create payload type to accept `approved_by_name`, `mrn_document_url`, `mrn_document_path` and pass them through to the insert.
- `src/types/assetRequest.ts` – add the same three optional string fields to the `AssetRequest` interface.
- Supabase generated types will refresh after the migration runs.

## Out of scope
- Displaying the MRN link in the list/details view (can be a follow-up).
- Changing the existing HOD approval workflow.
