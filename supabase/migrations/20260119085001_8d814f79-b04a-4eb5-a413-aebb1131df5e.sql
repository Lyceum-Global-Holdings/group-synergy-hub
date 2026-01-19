-- Create construction inventory transactions table
CREATE TABLE public.construction_inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  item_id UUID NOT NULL REFERENCES public.construction_inventory_master(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('stock_addition', 'stock_removal', 'transfer', 'adjustment', 'allocation', 'return')),
  quantity_change NUMERIC(15,4) NOT NULL,
  quantity_before NUMERIC(15,4) NOT NULL DEFAULT 0,
  quantity_after NUMERIC(15,4) NOT NULL DEFAULT 0,
  from_location_id UUID REFERENCES public.warehouse_locations(id),
  to_location_id UUID REFERENCES public.warehouse_locations(id),
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.construction_inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view construction inventory transactions"
ON public.construction_inventory_transactions
FOR SELECT
USING (true);

CREATE POLICY "Users can insert construction inventory transactions"
ON public.construction_inventory_transactions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update construction inventory transactions"
ON public.construction_inventory_transactions
FOR UPDATE
USING (true);

-- Create indexes for efficient querying
CREATE INDEX idx_construction_inv_transactions_item_id 
ON public.construction_inventory_transactions(item_id);

CREATE INDEX idx_construction_inv_transactions_created_at 
ON public.construction_inventory_transactions(created_at DESC);

CREATE INDEX idx_construction_inv_transactions_type 
ON public.construction_inventory_transactions(transaction_type);

-- Create trigger for updated_at
CREATE TRIGGER update_construction_inventory_transactions_updated_at
BEFORE UPDATE ON public.construction_inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();