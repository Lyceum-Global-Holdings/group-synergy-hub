
CREATE OR REPLACE FUNCTION public.generate_production_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM public.production_orders
  WHERE company_id = NEW.company_id;
  
  NEW.order_number := 'PRD-' || LPAD(next_num::text, 5, '0');
  RETURN NEW;
END;
$$;
