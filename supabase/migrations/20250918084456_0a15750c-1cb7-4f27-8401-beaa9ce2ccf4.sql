-- Fix security warnings by setting search_path for functions

-- Update generate_pr_number function with search_path
CREATE OR REPLACE FUNCTION public.generate_pr_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  pr_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(pr_number FROM 'PR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM purchase_requisitions
  WHERE pr_number LIKE 'PR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate PR number: PR-YYYYMMDD-001
  pr_number := 'PR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN pr_number;
END;
$$;

-- Update update_pr_total_amount function with search_path
CREATE OR REPLACE FUNCTION public.update_pr_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_amount DECIMAL(15,2);
BEGIN
  -- Calculate total from all items
  SELECT COALESCE(SUM(estimated_total_price), 0)
  INTO total_amount
  FROM pr_items
  WHERE pr_id = COALESCE(NEW.pr_id, OLD.pr_id);
  
  -- Update the PR total
  UPDATE purchase_requisitions
  SET total_estimated_amount = total_amount,
      updated_at = now()
  WHERE id = COALESCE(NEW.pr_id, OLD.pr_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;