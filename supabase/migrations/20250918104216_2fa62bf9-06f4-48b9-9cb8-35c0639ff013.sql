-- Fix the generate_pr_number function to avoid ambiguous column reference
CREATE OR REPLACE FUNCTION public.generate_pr_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_pr_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_requisitions.pr_number FROM 'PR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM purchase_requisitions
  WHERE purchase_requisitions.pr_number LIKE 'PR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate PR number: PR-YYYYMMDD-001
  new_pr_number := 'PR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_pr_number;
END;
$$;