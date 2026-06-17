
-- Multi-file attachments for MIN, MRN, and Material Requests
CREATE TABLE IF NOT EXISTS public.material_document_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type text NOT NULL CHECK (parent_type IN ('material_issue','material_return','material_request')),
  parent_id uuid NOT NULL,
  company_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('signed_srn','gate_pass','photo','delivery_proof','other')),
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  file_size bigint,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mda_parent ON public.material_document_attachments(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_mda_company_created ON public.material_document_attachments(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_document_attachments TO authenticated;
GRANT ALL ON public.material_document_attachments TO service_role;

ALTER TABLE public.material_document_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mda_select_company" ON public.material_document_attachments
  FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));

CREATE POLICY "mda_insert_company" ON public.material_document_attachments
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id) AND uploaded_by = auth.uid());

CREATE POLICY "mda_update_company" ON public.material_document_attachments
  FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id))
  WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "mda_delete_company" ON public.material_document_attachments
  FOR DELETE TO authenticated
  USING (public.can_access_company(company_id));

CREATE TRIGGER trg_mda_updated_at
  BEFORE UPDATE ON public.material_document_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Back-compat: keep srn_document_url in sync with the latest signed_srn attachment
CREATE OR REPLACE FUNCTION public.sync_srn_document_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_type text;
  v_parent_id uuid;
  v_latest_path text;
  v_table text;
BEGIN
  v_parent_type := COALESCE(NEW.parent_type, OLD.parent_type);
  v_parent_id := COALESCE(NEW.parent_id, OLD.parent_id);

  SELECT file_path INTO v_latest_path
  FROM public.material_document_attachments
  WHERE parent_type = v_parent_type
    AND parent_id = v_parent_id
    AND category = 'signed_srn'
  ORDER BY uploaded_at DESC
  LIMIT 1;

  IF v_parent_type = 'material_issue' THEN
    UPDATE public.material_issue_notes SET srn_document_url = v_latest_path WHERE id = v_parent_id;
  ELSIF v_parent_type = 'material_return' THEN
    -- material_return_notes has no srn_document_url today; skip safely
    PERFORM 1;
  ELSIF v_parent_type = 'material_request' THEN
    PERFORM 1;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_mda_sync_srn
  AFTER INSERT OR UPDATE OR DELETE ON public.material_document_attachments
  FOR EACH ROW EXECUTE FUNCTION public.sync_srn_document_url();
