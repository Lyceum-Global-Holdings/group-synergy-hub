## Goal
Let users view (and download) the invoice document attached to a GRN directly from the GRN Details dialog.

## Current state
- GRNs already store `invoice_document_url` (object path inside the `grn-invoices` Supabase storage bucket), set via `InvoiceUploadField` during create/edit.
- `GrnDetailsDialog.tsx` shows GRN info, supplier, financials, items — but no way to open the uploaded invoice.

## Change

In `src/components/warehouse/GrnDetailsDialog.tsx`:

1. When the GRN has `invoice_document_url`, render a new row in the **GRN Information** card:
   - Label: `Invoice Document:`
   - Two small buttons: **View** (opens in new tab) and **Download** (saves locally).
   - File-type icon (PDF vs image) next to the filename derived from the path.
2. Add a handler that requests a short-lived signed URL from Supabase storage:
   ```ts
   const { data } = await supabase.storage
     .from('grn-invoices')
     .createSignedUrl(grn.invoice_document_url, 300);
   window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
   ```
3. Download handler uses `supabase.storage.from('grn-invoices').download(path)` then triggers a Blob download (same pattern already used in `InvoiceUploadField.handleDownload`).
4. Show a toast + disabled state while the signed URL is being fetched; toast on failure.
5. If `invoice_document_url` is empty/null, show muted text `No invoice attached`.

## Out of scope
- No DB / RLS changes (bucket and column already exist).
- No changes to upload flow, items tab, or pricing history.

## Files
- Edit: `src/components/warehouse/GrnDetailsDialog.tsx`
