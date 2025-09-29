-- Add approval fields to customer_purchase_orders table
ALTER TABLE public.customer_purchase_orders
ADD COLUMN pending_approval boolean DEFAULT false,
ADD COLUMN approved_by uuid REFERENCES auth.users(id),
ADD COLUMN approved_date timestamp with time zone,
ADD COLUMN approval_comments text;

-- Update status enum to include approval states
ALTER TABLE public.customer_purchase_orders 
ALTER COLUMN status TYPE text;

-- Create customer_po_approvals table
CREATE TABLE public.customer_po_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpo_id uuid NOT NULL REFERENCES public.customer_purchase_orders(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'pending_approval')),
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create customer_po_workflow_tracking table for end-to-end tracking
CREATE TABLE public.customer_po_workflow_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpo_id uuid NOT NULL REFERENCES public.customer_purchase_orders(id) ON DELETE CASCADE,
  material_demand_id uuid REFERENCES public.material_demand(id),
  pr_id uuid,
  po_id uuid,
  workflow_stage text NOT NULL DEFAULT 'cpo_created' CHECK (workflow_stage IN (
    'cpo_created', 'cpo_approved', 'material_demand_planned', 'pr_created', 'pr_approved', 'po_created', 'po_approved', 'completed'
  )),
  stage_completed_at timestamp with time zone DEFAULT now(),
  stage_completed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_po_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_po_workflow_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_po_approvals
CREATE POLICY "Users can view CPO approvals they have access to"
ON public.customer_po_approvals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_purchase_orders cpo
    WHERE cpo.id = customer_po_approvals.cpo_id
    AND (cpo.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Admins can manage CPO approvals"
ON public.customer_po_approvals
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- RLS policies for customer_po_workflow_tracking
CREATE POLICY "Users can view workflow tracking for their CPOs"
ON public.customer_po_workflow_tracking
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_purchase_orders cpo
    WHERE cpo.id = customer_po_workflow_tracking.cpo_id
    AND (cpo.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can create workflow tracking for their CPOs"
ON public.customer_po_workflow_tracking
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_purchase_orders cpo
    WHERE cpo.id = customer_po_workflow_tracking.cpo_id
    AND (cpo.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can update workflow tracking for their CPOs"
ON public.customer_po_workflow_tracking
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.customer_purchase_orders cpo
    WHERE cpo.id = customer_po_workflow_tracking.cpo_id
    AND (cpo.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

-- Create trigger to automatically create workflow tracking
CREATE OR REPLACE FUNCTION public.create_cpo_workflow_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create initial workflow tracking entry
  INSERT INTO public.customer_po_workflow_tracking (
    cpo_id,
    workflow_stage,
    stage_completed_by
  ) VALUES (
    NEW.id,
    'cpo_created',
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_cpo_workflow_tracking_trigger
  AFTER INSERT ON public.customer_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cpo_workflow_tracking();

-- Create trigger to update workflow tracking on status changes
CREATE OR REPLACE FUNCTION public.update_cpo_workflow_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        WHEN NEW.status = 'confirmed' THEN 'cpo_approved'
        WHEN NEW.status = 'in_production' THEN 'po_approved'
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

CREATE TRIGGER update_cpo_workflow_tracking_trigger
  AFTER UPDATE ON public.customer_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cpo_workflow_tracking();