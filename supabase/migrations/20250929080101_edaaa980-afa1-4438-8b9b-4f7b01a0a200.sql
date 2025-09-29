-- Fix the customer_purchase_orders status check constraint to include missing statuses
ALTER TABLE customer_purchase_orders 
DROP CONSTRAINT IF EXISTS customer_purchase_orders_status_check;

-- Add the updated constraint with all required statuses
ALTER TABLE customer_purchase_orders 
ADD CONSTRAINT customer_purchase_orders_status_check 
CHECK (status IN ('draft', 'pending_approval', 'confirmed', 'rejected', 'in_production', 'delivered', 'completed', 'cancelled'));

-- Update the workflow tracking function to handle rejection and cancellation
CREATE OR REPLACE FUNCTION public.update_cpo_workflow_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update workflow tracking based on status changes
  IF NEW.status != OLD.status THEN
    INSERT INTO public.customer_po_workflow_tracking (
      cpo_id,
      workflow_stage,
      stage_completed_by,
      notes
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.status = 'pending_approval' THEN 'cpo_submitted'
        WHEN NEW.status = 'confirmed' THEN 'cpo_approved'
        WHEN NEW.status = 'rejected' THEN 'cpo_rejected'
        WHEN NEW.status = 'cancelled' THEN 'cpo_cancelled'
        WHEN NEW.status = 'in_production' THEN 'po_approved'
        WHEN NEW.status = 'delivered' THEN 'delivered'
        WHEN NEW.status = 'completed' THEN 'completed'
        ELSE OLD.status
      END,
      auth.uid(),
      CASE
        WHEN NEW.approval_comments IS NOT NULL THEN NEW.approval_comments
        ELSE 'Status updated to ' || NEW.status
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$;