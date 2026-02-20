
-- Create warehouse_stock_audit_logs table for desync trend tracking
CREATE TABLE public.warehouse_stock_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recorded_by   uuid NOT NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  total_items   integer NOT NULL,
  in_sync_count integer NOT NULL,
  desync_count  integer NOT NULL,
  no_bins_count integer NOT NULL,
  desynced_items jsonb NOT NULL DEFAULT '[]',
  no_bins_items  jsonb NOT NULL DEFAULT '[]'
);

-- Index for efficient trend queries
CREATE INDEX idx_warehouse_stock_audit_logs_company_time
  ON public.warehouse_stock_audit_logs (company_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.warehouse_stock_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock_audit_logs FORCE ROW LEVEL SECURITY;

-- Revoke from anon (zero-trust)
REVOKE ALL ON public.warehouse_stock_audit_logs FROM anon;

-- SELECT: authenticated users within the same company
CREATE POLICY "warehouse_audit_logs_select"
  ON public.warehouse_stock_audit_logs
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND company_id IN (
      SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
    )
  );

-- INSERT: authenticated users only
CREATE POLICY "warehouse_audit_logs_insert"
  ON public.warehouse_stock_audit_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND recorded_by = auth.uid()
    AND company_id IN (
      SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
    )
  );

-- DELETE: managers/admins only
CREATE POLICY "warehouse_audit_logs_delete"
  ON public.warehouse_stock_audit_logs
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND public.has_manager_access(auth.uid())
  );
