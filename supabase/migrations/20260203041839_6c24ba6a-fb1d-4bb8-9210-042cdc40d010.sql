-- Fix SQL injection vulnerability in calculate_kpi_value function
-- Replace unsafe EXECUTE with safe whitelist-based approach

-- Create a whitelist of allowed KPI queries (system-defined only)
CREATE TABLE IF NOT EXISTS public.kpi_query_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT UNIQUE NOT NULL,
  query_text TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kpi_query_whitelist ENABLE ROW LEVEL SECURITY;

-- Only super admins can modify the whitelist
CREATE POLICY "Only admins can view whitelist"
ON public.kpi_query_whitelist FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can manage whitelist"
ON public.kpi_query_whitelist FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Insert the pre-approved system queries into whitelist
INSERT INTO public.kpi_query_whitelist (query_hash, query_text, description)
VALUES 
  (md5('SELECT COUNT(*)::numeric FROM purchase_orders'), 'SELECT COUNT(*)::numeric FROM purchase_orders', 'Total purchase orders count'),
  (md5('SELECT COUNT(*)::numeric FROM purchase_orders WHERE status = ''pending'''), 'SELECT COUNT(*)::numeric FROM purchase_orders WHERE status = ''pending''', 'Pending PO count'),
  (md5('SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE DATE_TRUNC(''month'', order_date) = DATE_TRUNC(''month'', CURRENT_DATE)'), 'SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE DATE_TRUNC(''month'', order_date) = DATE_TRUNC(''month'', CURRENT_DATE)', 'Monthly procurement spend'),
  (md5('SELECT COUNT(*)::numeric FROM purchase_requisitions WHERE status NOT IN (''cancelled'', ''completed'')'), 'SELECT COUNT(*)::numeric FROM purchase_requisitions WHERE status NOT IN (''cancelled'', ''completed'')', 'Active PRs count'),
  (md5('SELECT COALESCE(SUM(quantity * unit_price), 0) FROM warehouse_items'), 'SELECT COALESCE(SUM(quantity * unit_price), 0) FROM warehouse_items', 'Total stock value'),
  (md5('SELECT COUNT(*)::numeric FROM goods_receipt_notes WHERE status = ''pending'''), 'SELECT COUNT(*)::numeric FROM goods_receipt_notes WHERE status = ''pending''', 'Pending GRNs count'),
  (md5('SELECT COUNT(*)::numeric FROM warehouse_items'), 'SELECT COUNT(*)::numeric FROM warehouse_items', 'Total warehouse items'),
  (md5('SELECT COUNT(*)::numeric FROM warehouse_items WHERE quantity < reorder_level'), 'SELECT COUNT(*)::numeric FROM warehouse_items WHERE quantity < reorder_level', 'Low stock items count'),
  (md5('SELECT COUNT(*)::numeric FROM journal_entries'), 'SELECT COUNT(*)::numeric FROM journal_entries', 'Total journal entries'),
  (md5('SELECT COUNT(*)::numeric FROM journal_entries WHERE DATE_TRUNC(''month'', entry_date) = DATE_TRUNC(''month'', CURRENT_DATE)'), 'SELECT COUNT(*)::numeric FROM journal_entries WHERE DATE_TRUNC(''month'', entry_date) = DATE_TRUNC(''month'', CURRENT_DATE)', 'Monthly journal entries'),
  (md5('SELECT COUNT(*)::numeric FROM accounting_periods WHERE status = ''open'''), 'SELECT COUNT(*)::numeric FROM accounting_periods WHERE status = ''open''', 'Active accounting periods'),
  (md5('SELECT COUNT(*)::numeric FROM suppliers WHERE status = ''active'''), 'SELECT COUNT(*)::numeric FROM suppliers WHERE status = ''active''', 'Active suppliers count'),
  (md5('SELECT COALESCE(AVG(overall_rating), 0) FROM suppliers WHERE overall_rating IS NOT NULL'), 'SELECT COALESCE(AVG(overall_rating), 0) FROM suppliers WHERE overall_rating IS NOT NULL', 'Average supplier rating'),
  (md5('SELECT COUNT(DISTINCT supplier_id)::numeric FROM supplier_risk_flags WHERE status = ''active'''), 'SELECT COUNT(DISTINCT supplier_id)::numeric FROM supplier_risk_flags WHERE status = ''active''', 'Suppliers under review'),
  (md5('SELECT COUNT(*)::numeric FROM contracts WHERE status = ''active'''), 'SELECT COUNT(*)::numeric FROM contracts WHERE status = ''active''', 'Active contracts count'),
  (md5('SELECT COUNT(*)::numeric FROM contracts WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL ''30 days'''), 'SELECT COUNT(*)::numeric FROM contracts WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL ''30 days''', 'Contracts expiring soon')
ON CONFLICT (query_hash) DO NOTHING;

-- Drop the unsafe function
DROP FUNCTION IF EXISTS public.calculate_kpi_value(UUID);

-- Create safe replacement function that only executes whitelisted queries
CREATE OR REPLACE FUNCTION public.calculate_kpi_value(p_kpi_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kpi RECORD;
  v_result NUMERIC := 0;
  v_query_hash TEXT;
  v_whitelisted_query TEXT;
BEGIN
  -- Get the KPI definition
  SELECT * INTO v_kpi FROM kpi_definitions WHERE id = p_kpi_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'KPI not found: %', p_kpi_id;
  END IF;
  
  -- Only process custom_sql type with non-null query
  IF v_kpi.calculation_type = 'custom_sql' AND v_kpi.sql_query IS NOT NULL THEN
    -- Calculate hash of the query to check against whitelist
    v_query_hash := md5(v_kpi.sql_query);
    
    -- Look up the query in the whitelist
    SELECT query_text INTO v_whitelisted_query 
    FROM kpi_query_whitelist 
    WHERE query_hash = v_query_hash;
    
    IF v_whitelisted_query IS NULL THEN
      -- Query not in whitelist - log attempt and return 0
      RAISE WARNING 'KPI query not in whitelist for KPI %: query hash %', p_kpi_id, v_query_hash;
      v_result := 0;
    ELSE
      -- Execute only the pre-approved whitelisted query (not user input)
      EXECUTE v_whitelisted_query INTO v_result;
      v_result := COALESCE(v_result, 0);
    END IF;
  ELSIF v_kpi.calculation_type = 'count' THEN
    -- Safe predefined count based on data_source
    IF v_kpi.data_source = 'purchase_orders' THEN
      SELECT COUNT(*)::numeric INTO v_result FROM purchase_orders;
    ELSIF v_kpi.data_source = 'warehouse_items' THEN
      SELECT COUNT(*)::numeric INTO v_result FROM warehouse_items;
    ELSIF v_kpi.data_source = 'suppliers' THEN
      SELECT COUNT(*)::numeric INTO v_result FROM suppliers WHERE status = 'active';
    ELSE
      v_result := 0;
    END IF;
  ELSIF v_kpi.calculation_type = 'sum' THEN
    -- Safe predefined sum based on data_source
    IF v_kpi.data_source = 'purchase_orders' THEN
      SELECT COALESCE(SUM(total_amount), 0) INTO v_result FROM purchase_orders;
    ELSIF v_kpi.data_source = 'warehouse_items' THEN
      SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_result FROM warehouse_items;
    ELSE
      v_result := 0;
    END IF;
  ELSIF v_kpi.calculation_type = 'average' THEN
    -- Safe predefined average based on data_source
    IF v_kpi.data_source = 'suppliers' THEN
      SELECT COALESCE(AVG(overall_rating), 0) INTO v_result FROM suppliers WHERE overall_rating IS NOT NULL;
    ELSE
      v_result := 0;
    END IF;
  END IF;
  
  -- Store in history
  INSERT INTO kpi_history (kpi_id, value, calculated_at)
  VALUES (p_kpi_id, v_result, now());
  
  RETURN v_result;
END;
$$;

-- Revoke direct execute from public, only allow authenticated users
REVOKE ALL ON FUNCTION public.calculate_kpi_value(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_kpi_value(UUID) TO authenticated;

-- Add comment documenting the security measures
COMMENT ON FUNCTION public.calculate_kpi_value(UUID) IS 
'Calculates KPI values using ONLY pre-approved whitelisted queries. 
Custom SQL queries must be registered in kpi_query_whitelist table by admins.
This prevents SQL injection attacks while maintaining flexibility for system KPIs.';