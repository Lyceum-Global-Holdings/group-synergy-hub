-- Create supplier analytics cache table
CREATE TABLE IF NOT EXISTS public.supplier_analytics_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_evaluations INTEGER NOT NULL DEFAULT 0,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  avg_performance_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_quality_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_punctuality_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  consistency_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  improvement_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  reliability_index NUMERIC(5,2) NOT NULL DEFAULT 0,
  performance_grade TEXT NOT NULL DEFAULT 'D',
  trend_direction TEXT NOT NULL DEFAULT 'stable',
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, calculation_date)
);

-- Enable RLS
ALTER TABLE public.supplier_analytics_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view analytics cache"
  ON public.supplier_analytics_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage analytics cache"
  ON public.supplier_analytics_cache FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Create function to calculate supplier analytics
CREATE OR REPLACE FUNCTION public.calculate_supplier_analytics(
  p_supplier_id UUID,
  p_period_months INTEGER DEFAULT 12
)
RETURNS TABLE (
  total_evaluations BIGINT,
  total_deliveries BIGINT,
  avg_performance_rate NUMERIC,
  avg_quality_score NUMERIC,
  avg_punctuality_score NUMERIC,
  consistency_score NUMERIC,
  improvement_rate NUMERIC,
  reliability_index NUMERIC,
  performance_grade TEXT,
  trend_direction TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stddev NUMERIC;
  v_recent_avg NUMERIC;
  v_previous_avg NUMERIC;
  v_grade TEXT;
  v_trend TEXT;
BEGIN
  -- Calculate basic metrics
  SELECT 
    COUNT(DISTINCT se.id),
    COALESCE(SUM(se.total_deliveries), 0),
    COALESCE(AVG(se.performance_rate), 0),
    COALESCE(AVG(
      (SELECT AVG(quality_score) 
       FROM supplier_evaluation_entries 
       WHERE evaluation_id = se.id)
    ), 0),
    COALESCE(AVG(
      (SELECT AVG(punctuality_score) 
       FROM supplier_evaluation_entries 
       WHERE evaluation_id = se.id)
    ), 0)
  INTO 
    total_evaluations,
    total_deliveries,
    avg_performance_rate,
    avg_quality_score,
    avg_punctuality_score
  FROM supplier_evaluations se
  WHERE se.supplier_id = p_supplier_id
    AND se.evaluation_start_date >= CURRENT_DATE - (p_period_months || ' months')::INTERVAL;

  -- Calculate consistency (lower stddev = higher consistency)
  SELECT COALESCE(100 - (STDDEV(performance_rate) * 2), 0)
  INTO v_stddev
  FROM supplier_evaluations
  WHERE supplier_id = p_supplier_id
    AND evaluation_start_date >= CURRENT_DATE - (p_period_months || ' months')::INTERVAL;
  
  consistency_score := GREATEST(0, LEAST(100, v_stddev));

  -- Calculate improvement rate (recent vs previous period)
  SELECT COALESCE(AVG(performance_rate), 0)
  INTO v_recent_avg
  FROM supplier_evaluations
  WHERE supplier_id = p_supplier_id
    AND evaluation_start_date >= CURRENT_DATE - INTERVAL '3 months';

  SELECT COALESCE(AVG(performance_rate), 0)
  INTO v_previous_avg
  FROM supplier_evaluations
  WHERE supplier_id = p_supplier_id
    AND evaluation_start_date >= CURRENT_DATE - INTERVAL '6 months'
    AND evaluation_start_date < CURRENT_DATE - INTERVAL '3 months';

  improvement_rate := CASE 
    WHEN v_previous_avg > 0 THEN ((v_recent_avg - v_previous_avg) / v_previous_avg) * 100
    ELSE 0
  END;

  -- Calculate reliability index (composite score)
  reliability_index := (
    (COALESCE(avg_performance_rate, 0) * 0.4) +
    (COALESCE(consistency_score, 0) * 0.3) +
    (CASE WHEN COALESCE(total_deliveries, 0) >= 10 THEN 100 ELSE COALESCE(total_deliveries, 0) * 10 END * 0.3)
  );

  -- Determine performance grade
  performance_grade := CASE
    WHEN avg_performance_rate >= 85 THEN 'A'
    WHEN avg_performance_rate >= 70 THEN 'B'
    WHEN avg_performance_rate >= 55 THEN 'C'
    ELSE 'D'
  END;

  -- Determine trend direction
  trend_direction := CASE
    WHEN improvement_rate > 5 THEN 'improving'
    WHEN improvement_rate < -5 THEN 'declining'
    ELSE 'stable'
  END;

  RETURN QUERY SELECT 
    total_evaluations,
    total_deliveries,
    avg_performance_rate,
    avg_quality_score,
    avg_punctuality_score,
    consistency_score,
    improvement_rate,
    reliability_index,
    performance_grade,
    trend_direction;
END;
$$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_supplier_analytics_cache_supplier 
  ON public.supplier_analytics_cache(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_analytics_cache_date 
  ON public.supplier_analytics_cache(calculation_date);
CREATE INDEX IF NOT EXISTS idx_supplier_analytics_cache_grade 
  ON public.supplier_analytics_cache(performance_grade);