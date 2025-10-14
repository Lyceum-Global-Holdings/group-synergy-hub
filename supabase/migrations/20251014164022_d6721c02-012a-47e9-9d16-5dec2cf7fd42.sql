-- Fix the sales order status update trigger
-- The original function tried to set status to 'ready_for_dispatch' which is not valid
-- Changing it to 'dispatched' which is a valid sales order status

CREATE OR REPLACE FUNCTION public.update_so_on_do_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE sales_orders
    SET status = 'dispatched',
        updated_at = NOW()
    WHERE id = NEW.sales_order_id;
  END IF;
  RETURN NEW;
END;
$$;