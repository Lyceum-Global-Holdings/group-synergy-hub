-- Create suppliers table
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_code text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  supplier_type text NOT NULL DEFAULT 'vendor',
  category text,
  status text NOT NULL DEFAULT 'active',
  email text,
  phone text,
  website text,
  tax_id text,
  registration_number text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  payment_terms text,
  credit_limit numeric(15,2),
  currency text DEFAULT 'USD',
  rating numeric(2,1) CHECK (rating >= 1 AND rating <= 5),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create supplier_contacts table
CREATE TABLE public.supplier_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  email text,
  phone text,
  mobile text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for suppliers
CREATE POLICY "Authenticated users can view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create suppliers" 
ON public.suppliers 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update suppliers they created or admins can update any" 
ON public.suppliers 
FOR UPDATE 
USING (((auth.uid() = created_by) OR is_admin(auth.uid())));

CREATE POLICY "Admins can delete suppliers" 
ON public.suppliers 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create policies for supplier_contacts
CREATE POLICY "Authenticated users can view supplier contacts" 
ON public.supplier_contacts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage supplier contacts" 
ON public.supplier_contacts 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX idx_suppliers_code ON public.suppliers(supplier_code);
CREATE INDEX idx_suppliers_name ON public.suppliers(name);
CREATE INDEX idx_suppliers_status ON public.suppliers(status);
CREATE INDEX idx_suppliers_category ON public.suppliers(category);
CREATE INDEX idx_supplier_contacts_supplier_id ON public.supplier_contacts(supplier_id);

-- Create function to generate supplier code
CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  supplier_code TEXT;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(supplier_code FROM 'SUP-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM suppliers
  WHERE supplier_code LIKE 'SUP-%';
  
  -- Generate supplier code: SUP-0001
  supplier_code := 'SUP-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN supplier_code;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_contacts_updated_at
BEFORE UPDATE ON public.supplier_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();