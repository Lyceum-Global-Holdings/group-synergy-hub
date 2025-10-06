-- Create supplier_items junction table for many-to-many relationship
CREATE TABLE public.supplier_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  warehouse_item_id UUID NOT NULL REFERENCES public.warehouse_items(id) ON DELETE CASCADE,
  
  -- Supplier-specific pricing and details
  supplier_item_code TEXT,
  supplier_unit_price NUMERIC(15,2),
  minimum_order_quantity NUMERIC(15,2) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 0,
  is_preferred_supplier BOOLEAN DEFAULT false,
  
  -- Additional metadata
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  
  -- Audit fields
  company_id UUID REFERENCES public.companies(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique supplier-item combinations
  UNIQUE(supplier_id, warehouse_item_id)
);

-- Enable Row Level Security
ALTER TABLE public.supplier_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for supplier_items
CREATE POLICY "Authenticated users can view supplier items"
  ON public.supplier_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create supplier items"
  ON public.supplier_items
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update supplier items they created or admins can update any"
  ON public.supplier_items
  FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete supplier items"
  ON public.supplier_items
  FOR DELETE
  USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_supplier_items_updated_at
  BEFORE UPDATE ON public.supplier_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_supplier_items_supplier_id ON public.supplier_items(supplier_id);
CREATE INDEX idx_supplier_items_warehouse_item_id ON public.supplier_items(warehouse_item_id);
CREATE INDEX idx_supplier_items_company_id ON public.supplier_items(company_id);