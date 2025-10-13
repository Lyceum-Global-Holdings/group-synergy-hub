-- Create enums for asset requests
CREATE TYPE public.asset_request_status AS ENUM (
  'draft',
  'pending_hod_approval',
  'pending_procurement_approval',
  'approved',
  'rejected',
  'fulfilled',
  'partially_fulfilled',
  'cancelled'
);

CREATE TYPE public.asset_request_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE public.asset_request_item_type AS ENUM (
  'from_master',
  'new_item'
);

CREATE TYPE public.asset_fulfillment_method AS ENUM (
  'from_stock',
  'purchase',
  'transfer'
);

CREATE TYPE public.asset_request_item_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'fulfilled',
  'partially_fulfilled'
);

CREATE TYPE public.asset_approval_level AS ENUM (
  'hod',
  'procurement',
  'management'
);

CREATE TYPE public.asset_approval_action AS ENUM (
  'approved',
  'rejected',
  'requested_changes'
);

-- Create asset_requests table
CREATE TABLE public.asset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_by UUID REFERENCES auth.users(id),
  requester_name TEXT NOT NULL,
  department TEXT,
  contact_number TEXT,
  purpose TEXT NOT NULL,
  justification TEXT,
  required_date DATE NOT NULL,
  priority asset_request_priority NOT NULL DEFAULT 'medium',
  status asset_request_status NOT NULL DEFAULT 'draft',
  hod_approved_by UUID REFERENCES auth.users(id),
  hod_approval_date TIMESTAMP WITH TIME ZONE,
  hod_comments TEXT,
  procurement_approved_by UUID REFERENCES auth.users(id),
  procurement_approval_date TIMESTAMP WITH TIME ZONE,
  procurement_comments TEXT,
  rejection_reason TEXT,
  fulfilled_date DATE,
  fulfilled_by UUID REFERENCES auth.users(id),
  total_estimated_cost NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  company_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create asset_request_items table
CREATE TABLE public.asset_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.asset_requests(id) ON DELETE CASCADE,
  line_number INTEGER,
  request_type asset_request_item_type NOT NULL,
  asset_master_id UUID REFERENCES public.asset_master(id),
  item_name TEXT NOT NULL,
  item_description TEXT,
  brand TEXT,
  category_id UUID REFERENCES public.asset_categories(id),
  subcategory_id UUID REFERENCES public.asset_categories(id),
  quantity_requested INTEGER NOT NULL,
  quantity_approved INTEGER,
  quantity_fulfilled INTEGER DEFAULT 0,
  unit_price_estimate NUMERIC(15,2),
  total_price_estimate NUMERIC(15,2),
  specifications TEXT,
  justification TEXT,
  preferred_vendor TEXT,
  status asset_request_item_status DEFAULT 'pending',
  fulfillment_method asset_fulfillment_method,
  warehouse_asset_id UUID REFERENCES public.warehouse_assets(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create asset_request_approvals table
CREATE TABLE public.asset_request_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.asset_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  approval_level asset_approval_level NOT NULL,
  action asset_approval_action NOT NULL,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Function to generate asset request numbers
CREATE OR REPLACE FUNCTION public.generate_asset_request_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_request_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 'AR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM asset_requests
  WHERE request_number LIKE 'AR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate request number: AR-YYYYMMDD-001
  new_request_number := 'AR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_request_number;
END;
$$;

-- Trigger to auto-generate request numbers
CREATE OR REPLACE FUNCTION public.auto_generate_asset_request_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_asset_request_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_asset_request_number
BEFORE INSERT ON public.asset_requests
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_asset_request_number();

-- Function to update asset request total cost
CREATE OR REPLACE FUNCTION public.update_asset_request_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  request_total NUMERIC(15,2);
BEGIN
  -- Calculate total from all items for the specific request
  SELECT COALESCE(SUM(total_price_estimate), 0)
  INTO request_total
  FROM asset_request_items
  WHERE request_id = COALESCE(NEW.request_id, OLD.request_id);
  
  -- Update the request total
  UPDATE asset_requests
  SET total_estimated_cost = request_total,
      updated_at = now()
  WHERE id = COALESCE(NEW.request_id, OLD.request_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to update request total on item changes
CREATE TRIGGER update_asset_request_total
AFTER INSERT OR UPDATE OR DELETE ON public.asset_request_items
FOR EACH ROW
EXECUTE FUNCTION public.update_asset_request_total();

-- Enable RLS
ALTER TABLE public.asset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_request_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for asset_requests
CREATE POLICY "Users can view their own requests"
ON public.asset_requests
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = created_by OR
    auth.uid() = requested_by OR
    is_admin(auth.uid())
  )
);

CREATE POLICY "Users can create asset requests"
ON public.asset_requests
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  auth.uid() = created_by
);

CREATE POLICY "Users can update their own draft requests"
ON public.asset_requests
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    (auth.uid() = created_by AND status = 'draft') OR
    is_admin(auth.uid())
  )
);

CREATE POLICY "Users can delete their own draft requests"
ON public.asset_requests
FOR DELETE
USING (
  auth.uid() = created_by AND
  status = 'draft'
);

-- RLS Policies for asset_request_items
CREATE POLICY "Users can view items for accessible requests"
ON public.asset_request_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM asset_requests
    WHERE asset_requests.id = asset_request_items.request_id
    AND (
      auth.uid() = asset_requests.created_by OR
      auth.uid() = asset_requests.requested_by OR
      is_admin(auth.uid())
    )
  )
);

CREATE POLICY "Users can manage items for their requests"
ON public.asset_request_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM asset_requests
    WHERE asset_requests.id = asset_request_items.request_id
    AND (
      (auth.uid() = asset_requests.created_by AND asset_requests.status = 'draft') OR
      is_admin(auth.uid())
    )
  )
);

-- RLS Policies for asset_request_approvals
CREATE POLICY "Users can view approvals for accessible requests"
ON public.asset_request_approvals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM asset_requests
    WHERE asset_requests.id = asset_request_approvals.request_id
    AND (
      auth.uid() = asset_requests.created_by OR
      auth.uid() = asset_requests.requested_by OR
      is_admin(auth.uid())
    )
  )
);

CREATE POLICY "Admins can create approvals"
ON public.asset_request_approvals
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) AND
  auth.uid() = approver_id
);

-- Create indexes for performance
CREATE INDEX idx_asset_requests_status ON public.asset_requests(status);
CREATE INDEX idx_asset_requests_created_by ON public.asset_requests(created_by);
CREATE INDEX idx_asset_requests_company_id ON public.asset_requests(company_id);
CREATE INDEX idx_asset_request_items_request_id ON public.asset_request_items(request_id);
CREATE INDEX idx_asset_request_approvals_request_id ON public.asset_request_approvals(request_id);