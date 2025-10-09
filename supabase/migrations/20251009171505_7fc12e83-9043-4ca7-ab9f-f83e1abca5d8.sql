-- Create putaway_records table
CREATE TABLE public.putaway_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  putaway_number text NOT NULL UNIQUE,
  grn_id uuid REFERENCES goods_receipt_notes(id),
  grn_number text,
  status text NOT NULL DEFAULT 'pending',
  putaway_date date NOT NULL DEFAULT CURRENT_DATE,
  completed_date timestamp with time zone,
  assigned_to uuid,
  completed_by uuid,
  notes text,
  company_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create putaway_items table
CREATE TABLE public.putaway_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  putaway_id uuid NOT NULL REFERENCES putaway_records(id) ON DELETE CASCADE,
  warehouse_item_id uuid NOT NULL REFERENCES warehouse_items(id),
  item_code text,
  item_name text NOT NULL,
  quantity numeric NOT NULL,
  unit_of_measure text DEFAULT 'pcs',
  from_location_id uuid REFERENCES warehouse_locations(id),
  to_bin_id uuid REFERENCES warehouse_bins(id),
  status text NOT NULL DEFAULT 'pending',
  putaway_sequence integer,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create function to generate putaway numbers (returns text)
CREATE OR REPLACE FUNCTION public.generate_putaway_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_putaway_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(putaway_number FROM 'PUT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM putaway_records
  WHERE putaway_number LIKE 'PUT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_putaway_number := 'PUT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_putaway_number;
END;
$$;

-- Create trigger function (returns trigger)
CREATE OR REPLACE FUNCTION public.auto_generate_putaway_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.putaway_number IS NULL OR NEW.putaway_number = '' THEN
    NEW.putaway_number := generate_putaway_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating putaway numbers
CREATE TRIGGER auto_generate_putaway_number
  BEFORE INSERT ON putaway_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_putaway_number();

-- Enable RLS
ALTER TABLE public.putaway_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.putaway_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for putaway_records
CREATE POLICY "Authenticated users can view putaway records"
  ON putaway_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create putaway records"
  ON putaway_records FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own putaway or admins can update any"
  ON putaway_records FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete putaway records"
  ON putaway_records FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for putaway_items
CREATE POLICY "Authenticated users can view putaway items"
  ON putaway_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage putaway items for their own putaways"
  ON putaway_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM putaway_records pr
    WHERE pr.id = putaway_items.putaway_id
    AND (pr.created_by = auth.uid() OR is_admin(auth.uid()))
  ));