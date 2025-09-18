-- Create purchase requisition tables and related structures

-- Create status enum for purchase requisitions
CREATE TYPE public.pr_status AS ENUM ('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'cancelled');

-- Create priority enum
CREATE TYPE public.pr_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create purchase requisitions table
CREATE TABLE public.purchase_requisitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pr_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  requested_by UUID NOT NULL,
  department TEXT,
  status pr_status NOT NULL DEFAULT 'draft',
  priority pr_priority NOT NULL DEFAULT 'medium',
  requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE NOT NULL,
  justification TEXT,
  total_estimated_amount DECIMAL(15,2) DEFAULT 0,
  approved_by UUID,
  approved_date TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase requisition items table
CREATE TABLE public.pr_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pr_id UUID NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity DECIMAL(10,2) NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  estimated_unit_price DECIMAL(15,2) NOT NULL,
  estimated_total_price DECIMAL(15,2) NOT NULL,
  specifications TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create PR approval history table
CREATE TABLE public.pr_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pr_id UUID NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  action pr_status NOT NULL,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_requisitions
CREATE POLICY "Users can view PRs they created or if admin"
ON public.purchase_requisitions
FOR SELECT
USING (auth.uid() = requested_by OR is_admin(auth.uid()));

CREATE POLICY "Users can create their own PRs"
ON public.purchase_requisitions
FOR INSERT
WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can update their own draft PRs or admins can update any"
ON public.purchase_requisitions
FOR UPDATE
USING (
  (auth.uid() = requested_by AND status = 'draft') OR 
  is_admin(auth.uid())
);

CREATE POLICY "Admins can delete PRs"
ON public.purchase_requisitions
FOR DELETE
USING (is_admin(auth.uid()));

-- RLS Policies for pr_items
CREATE POLICY "Users can view items of PRs they have access to"
ON public.pr_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_items.pr_id 
    AND (pr.requested_by = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage items of their own draft PRs"
ON public.pr_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_items.pr_id 
    AND pr.requested_by = auth.uid()
    AND pr.status = 'draft'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_items.pr_id 
    AND pr.requested_by = auth.uid()
    AND pr.status = 'draft'
  )
);

CREATE POLICY "Admins can manage all PR items"
ON public.pr_items
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for pr_approvals
CREATE POLICY "Users can view approvals for PRs they have access to"
ON public.pr_approvals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requisitions pr
    WHERE pr.id = pr_approvals.pr_id 
    AND (pr.requested_by = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Admins can manage all approvals"
ON public.pr_approvals
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_purchase_requisitions_updated_at
  BEFORE UPDATE ON public.purchase_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pr_items_updated_at
  BEFORE UPDATE ON public.pr_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate PR number
CREATE OR REPLACE FUNCTION public.generate_pr_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create function to update PR total amount
CREATE OR REPLACE FUNCTION public.update_pr_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Create trigger to auto-update PR total when items change
CREATE TRIGGER update_pr_total_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.pr_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pr_total_amount();