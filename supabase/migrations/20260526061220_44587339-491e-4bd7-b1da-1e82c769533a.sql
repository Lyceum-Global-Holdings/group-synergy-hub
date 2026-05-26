ALTER TABLE public.material_requests     ADD COLUMN IF NOT EXISTS srn_document_url text;
ALTER TABLE public.material_return_notes ADD COLUMN IF NOT EXISTS srn_document_url text;

COMMENT ON COLUMN public.material_requests.srn_document_url IS
  'Storage path in min-srn-documents bucket. Photo/scan of the signed Stock Requisition Note (SRN).';
COMMENT ON COLUMN public.material_return_notes.srn_document_url IS
  'Storage path in min-srn-documents bucket. Photo/scan of the signed Stock Requisition Note (SRN).';