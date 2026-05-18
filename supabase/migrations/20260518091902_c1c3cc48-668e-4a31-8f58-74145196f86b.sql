-- =====================================================================
-- Scheduled Telegram Reports (Administration Console)
-- =====================================================================

-- Report type & frequency enums (text-based with CHECK for flexibility)
CREATE TABLE IF NOT EXISTS public.telegram_scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN (
    'warehouse_stock_daily',
    'tool_management_daily',
    'site_report_daily',
    'stock_transfer_daily'
  )),
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  send_time time NOT NULL DEFAULT '18:00',
  timezone text NOT NULL DEFAULT 'UTC',
  weekday smallint CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  day_of_month smallint CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 28),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  chat_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_scheduled_jobs_weekly_needs_weekday CHECK (
    frequency <> 'weekly' OR weekday IS NOT NULL
  ),
  CONSTRAINT telegram_scheduled_jobs_monthly_needs_dom CHECK (
    frequency <> 'monthly' OR day_of_month IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_tg_jobs_dispatch
  ON public.telegram_scheduled_jobs(is_enabled, next_run_at)
  WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_tg_jobs_company
  ON public.telegram_scheduled_jobs(company_id, report_type);

-- Run history
CREATE TABLE IF NOT EXISTS public.telegram_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.telegram_scheduled_jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
  recipient_count integer NOT NULL DEFAULT 0,
  error_text text,
  payload_preview text,
  triggered_by text NOT NULL DEFAULT 'cron' CHECK (triggered_by IN ('cron','manual','test'))
);

CREATE INDEX IF NOT EXISTS idx_tg_runs_job ON public.telegram_job_runs(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tg_runs_company ON public.telegram_job_runs(company_id, started_at DESC);

-- updated_at trigger
CREATE TRIGGER trg_telegram_scheduled_jobs_updated_at
  BEFORE UPDATE ON public.telegram_scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- RLS
-- =====================================================================
ALTER TABLE public.telegram_scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_job_runs ENABLE ROW LEVEL SECURITY;

-- SELECT: any user with company access
CREATE POLICY "View scheduled jobs in own company"
  ON public.telegram_scheduled_jobs FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));

-- INSERT/UPDATE/DELETE: admins or super_admins
CREATE POLICY "Admins manage scheduled jobs"
  ON public.telegram_scheduled_jobs FOR ALL TO authenticated
  USING (
    public.can_access_company(company_id) AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    public.can_access_company(company_id) AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "View job runs in own company"
  ON public.telegram_job_runs FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));

CREATE POLICY "Admins manage job runs"
  ON public.telegram_job_runs FOR ALL TO authenticated
  USING (
    public.can_access_company(company_id) AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    public.can_access_company(company_id) AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- =====================================================================
-- next_run_at helper
-- =====================================================================
CREATE OR REPLACE FUNCTION public.compute_telegram_job_next_run(
  p_frequency text,
  p_send_time time,
  p_timezone text,
  p_weekday smallint,
  p_day_of_month smallint,
  p_from timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  tz text := COALESCE(NULLIF(p_timezone,''),'UTC');
  local_now timestamp;
  candidate timestamp;
  candidate_utc timestamptz;
  add_days integer;
BEGIN
  local_now := (p_from AT TIME ZONE tz);
  candidate := date_trunc('day', local_now) + p_send_time;

  IF p_frequency = 'daily' THEN
    IF candidate <= local_now THEN
      candidate := candidate + interval '1 day';
    END IF;

  ELSIF p_frequency = 'weekly' THEN
    -- weekday 0=Sun .. 6=Sat; postgres extract(dow)=0..6 same
    add_days := (p_weekday - extract(dow FROM candidate)::int + 7) % 7;
    candidate := candidate + (add_days || ' days')::interval;
    IF candidate <= local_now THEN
      candidate := candidate + interval '7 days';
    END IF;

  ELSIF p_frequency = 'monthly' THEN
    candidate := date_trunc('month', local_now)
                 + ((p_day_of_month - 1) || ' days')::interval
                 + p_send_time;
    IF candidate <= local_now THEN
      candidate := (date_trunc('month', local_now) + interval '1 month')
                   + ((p_day_of_month - 1) || ' days')::interval
                   + p_send_time;
    END IF;
  END IF;

  candidate_utc := candidate AT TIME ZONE tz;
  RETURN candidate_utc;
END;
$$;

-- Trigger to auto-compute next_run_at
CREATE OR REPLACE FUNCTION public.telegram_job_set_next_run()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_enabled THEN
    NEW.next_run_at := public.compute_telegram_job_next_run(
      NEW.frequency, NEW.send_time, NEW.timezone, NEW.weekday, NEW.day_of_month,
      COALESCE(NEW.last_run_at, now())
    );
  ELSE
    NEW.next_run_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_telegram_job_set_next_run
  BEFORE INSERT OR UPDATE OF frequency, send_time, timezone, weekday, day_of_month, is_enabled, last_run_at
  ON public.telegram_scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION public.telegram_job_set_next_run();

-- =====================================================================
-- Backfill: turn existing DSR schedule into a site_report_daily job
-- =====================================================================
INSERT INTO public.telegram_scheduled_jobs
  (company_id, name, report_type, frequency, send_time, timezone, is_enabled, last_run_at)
SELECT
  ts.company_id,
  'Daily Site Report',
  'site_report_daily',
  'daily',
  COALESCE(ts.scheduled_send_time, '18:00'::time),
  COALESCE(ts.timezone, 'UTC'),
  COALESCE(ts.scheduled_send_enabled, false),
  ts.last_scheduled_send
FROM public.telegram_settings ts
WHERE COALESCE(ts.scheduled_send_enabled, false) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.telegram_scheduled_jobs j
    WHERE j.company_id = ts.company_id AND j.report_type = 'site_report_daily'
  );

-- Enable realtime (optional but consistent with other admin tables)
ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_scheduled_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_job_runs;