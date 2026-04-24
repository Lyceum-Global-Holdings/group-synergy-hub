-- Performance metrics capture table
CREATE TABLE public.performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metric_kind text NOT NULL,
  metric_value numeric NOT NULL,
  route text NOT NULL,
  company_id uuid,
  user_id uuid,
  context jsonb,
  CONSTRAINT performance_metrics_kind_check
    CHECK (metric_kind IN ('lcp','inp','cls','ttfb','fcp','longtask','slow_query'))
);

-- Composite indexes (Phase 4 standard)
CREATE INDEX idx_perf_metrics_route_recorded
  ON public.performance_metrics (route, recorded_at DESC);
CREATE INDEX idx_perf_metrics_kind_recorded
  ON public.performance_metrics (metric_kind, recorded_at DESC);
CREATE INDEX idx_perf_metrics_recorded
  ON public.performance_metrics (recorded_at DESC);

-- RLS
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own metrics
CREATE POLICY "users insert own perf metrics"
  ON public.performance_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only admins/super_admins can read the metrics
CREATE POLICY "admins read perf metrics"
  ON public.performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Aggregation RPC for the dashboard
CREATE OR REPLACE FUNCTION public.get_performance_summary(p_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(days => GREATEST(p_days, 1));
  v_route_summary jsonb;
  v_slow_queries jsonb;
  v_long_tasks jsonb;
BEGIN
  -- p50/p75/p95 per (route, metric_kind) for vitals
  SELECT jsonb_agg(row_to_json(t))
  INTO v_route_summary
  FROM (
    SELECT
      route,
      metric_kind,
      count(*)::int AS sample_count,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY metric_value)::numeric(10,2) AS p50,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY metric_value)::numeric(10,2) AS p75,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY metric_value)::numeric(10,2) AS p95
    FROM public.performance_metrics
    WHERE recorded_at >= v_since
      AND metric_kind IN ('lcp','inp','cls','ttfb','fcp')
    GROUP BY route, metric_kind
    ORDER BY route, metric_kind
  ) t;

  -- Top 20 slow queries by p95
  SELECT jsonb_agg(row_to_json(t))
  INTO v_slow_queries
  FROM (
    SELECT
      COALESCE(context->>'rpc', context->>'table', 'unknown') AS target,
      count(*)::int AS call_count,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY metric_value)::numeric(10,2) AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY metric_value)::numeric(10,2) AS p95,
      max(metric_value)::numeric(10,2) AS max_ms
    FROM public.performance_metrics
    WHERE recorded_at >= v_since
      AND metric_kind = 'slow_query'
    GROUP BY 1
    ORDER BY p95 DESC
    LIMIT 20
  ) t;

  -- Long tasks per route (count + p75 duration)
  SELECT jsonb_agg(row_to_json(t))
  INTO v_long_tasks
  FROM (
    SELECT
      route,
      count(*)::int AS task_count,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY metric_value)::numeric(10,2) AS p75_duration
    FROM public.performance_metrics
    WHERE recorded_at >= v_since
      AND metric_kind = 'longtask'
    GROUP BY route
    ORDER BY task_count DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'window_days', p_days,
    'generated_at', now(),
    'vitals', COALESCE(v_route_summary, '[]'::jsonb),
    'slow_queries', COALESCE(v_slow_queries, '[]'::jsonb),
    'long_tasks', COALESCE(v_long_tasks, '[]'::jsonb)
  );
END;
$$;