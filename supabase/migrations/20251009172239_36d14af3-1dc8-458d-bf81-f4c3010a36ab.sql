-- Create stock_transfer_requests table
CREATE TABLE public.stock_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text NOT NULL UNIQUE,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  from_location_id uuid REFERENCES warehouse_locations(id),
  from_sublocation_id uuid REFERENCES warehouse_locations(id),
  from_department_id uuid REFERENCES warehouse_locations(id),
  to_location_id uuid REFERENCES warehouse_locations(id),
  to_sublocation_id uuid REFERENCES warehouse_locations(id),
  to_department_id uuid REFERENCES warehouse_locations(id),
  status text NOT NULL DEFAULT 'draft',
  transfer_type text NOT NULL DEFAULT 'location',
  priority text NOT NULL DEFAULT 'normal',
  requested_by uuid,
  approved_by uuid,
  completed_by uuid,
  requested_date timestamp with time zone DEFAULT now(),
  approved_date timestamp with time zone,
  completed_date timestamp with time zone,
  expected_completion_date date,
  reason text,
  notes text,
  company_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create stock_transfer_items table
CREATE TABLE public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES stock_transfer_requests(id) ON DELETE CASCADE,
  warehouse_item_id uuid NOT NULL REFERENCES warehouse_items(id),
  item_code text,
  item_name text NOT NULL,
  quantity_requested numeric NOT NULL,
  quantity_transferred numeric DEFAULT 0,
  unit_of_measure text DEFAULT 'pcs',
  from_bin_id uuid REFERENCES warehouse_bins(id),
  to_bin_id uuid REFERENCES warehouse_bins(id),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create function to generate transfer numbers
CREATE OR REPLACE FUNCTION public.generate_transfer_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_transfer_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(transfer_number FROM 'STR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM stock_transfer_requests
  WHERE transfer_number LIKE 'STR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_transfer_number := 'STR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_transfer_number;
END;
$$;

-- Create trigger function for auto-generating transfer numbers
CREATE OR REPLACE FUNCTION public.auto_generate_transfer_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.transfer_number IS NULL OR NEW.transfer_number = '' THEN
    NEW.transfer_number := generate_transfer_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating transfer numbers
CREATE TRIGGER auto_generate_transfer_number
  BEFORE INSERT ON stock_transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_transfer_number();

-- Enable RLS
ALTER TABLE stock_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_transfer_requests
CREATE POLICY "Authenticated users can view transfer requests"
  ON stock_transfer_requests FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create transfer requests"
  ON stock_transfer_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own requests or admins can update any"
  ON stock_transfer_requests FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete transfer requests"
  ON stock_transfer_requests FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for stock_transfer_items
CREATE POLICY "Authenticated users can view transfer items"
  ON stock_transfer_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage transfer items for their own requests"
  ON stock_transfer_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM stock_transfer_requests str
    WHERE str.id = stock_transfer_items.transfer_id
    AND (str.created_by = auth.uid() OR is_admin(auth.uid()))
  ));