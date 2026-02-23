
-- Create system_error_logs table for centralized edge function error tracking
CREATE TABLE public.system_error_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id         uuid,
  function_name   text NOT NULL,
  error_message   text NOT NULL,
  error_code      integer,
  request_context jsonb DEFAULT '{}',
  resolution      text,
  status          text NOT NULL DEFAULT 'open',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_error_logs FORCE ROW LEVEL SECURITY;

-- Revoke anon access
REVOKE ALL ON public.system_error_logs FROM anon;

-- SELECT: authenticated users within their company
CREATE POLICY "Users can view error logs for their company"
ON public.system_error_logs FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND company_id IN (
    SELECT uca.company_id FROM public.user_company_access uca WHERE uca.user_id = auth.uid()
  )
);

-- INSERT: any authenticated user can log errors
CREATE POLICY "Authenticated users can insert error logs"
ON public.system_error_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: authenticated users within their company (to dismiss)
CREATE POLICY "Users can update error logs for their company"
ON public.system_error_logs FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND company_id IN (
    SELECT uca.company_id FROM public.user_company_access uca WHERE uca.user_id = auth.uid()
  )
);

-- Indexes for efficient querying
CREATE INDEX idx_system_error_logs_company_created ON public.system_error_logs (company_id, created_at DESC);
CREATE INDEX idx_system_error_logs_function_created ON public.system_error_logs (function_name, created_at DESC);
CREATE INDEX idx_system_error_logs_status ON public.system_error_logs (status);
