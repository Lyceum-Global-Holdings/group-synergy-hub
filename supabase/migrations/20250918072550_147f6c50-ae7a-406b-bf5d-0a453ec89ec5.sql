-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  modules TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create policies for companies (for now, allow all authenticated users to manage companies)
CREATE POLICY "Authenticated users can view companies" 
ON public.companies 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update companies" 
ON public.companies 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete companies" 
ON public.companies 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample data
INSERT INTO public.companies (name, code, address, status, modules) VALUES
  ('Acme Corporation', 'ACME', '123 Business Ave, New York, NY', 'active', ARRAY['Finance', 'Procurement', 'Warehouse']),
  ('Global Industries', 'GLOB', '456 Corporate Blvd, Los Angeles, CA', 'active', ARRAY['Finance', 'Sourcing', 'Management']),
  ('Tech Solutions Ltd', 'TECH', '789 Innovation Dr, San Francisco, CA', 'active', ARRAY['Procurement', 'Warehouse', 'Sourcing']),
  ('Manufacturing Co', 'MFG', '321 Industrial Way, Detroit, MI', 'inactive', ARRAY['Finance', 'Warehouse']);