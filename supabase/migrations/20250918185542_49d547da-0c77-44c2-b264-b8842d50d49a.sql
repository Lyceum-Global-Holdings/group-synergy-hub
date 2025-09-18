-- Create asset_transfers table for proper transfer history tracking
CREATE TABLE public.asset_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES warehouse_assets(id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES warehouse_locations(id),
  to_location_id UUID REFERENCES warehouse_locations(id),
  from_sublocation_id UUID REFERENCES warehouse_locations(id),
  to_sublocation_id UUID REFERENCES warehouse_locations(id),
  from_department_id UUID REFERENCES warehouse_locations(id),
  to_department_id UUID REFERENCES warehouse_locations(id),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transfer_reason TEXT,
  transferred_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.asset_transfers ENABLE ROW LEVEL SECURITY;

-- Create policies for asset_transfers
CREATE POLICY "Authenticated users can view asset transfers" 
ON public.asset_transfers 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create asset transfers" 
ON public.asset_transfers 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = transferred_by);

CREATE POLICY "Users can update transfers they created or admins can update any" 
ON public.asset_transfers 
FOR UPDATE 
USING (auth.uid() = transferred_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete asset transfers" 
ON public.asset_transfers 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_asset_transfers_updated_at
  BEFORE UPDATE ON public.asset_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_asset_transfers_asset_id ON public.asset_transfers(asset_id);
CREATE INDEX idx_asset_transfers_transfer_date ON public.asset_transfers(transfer_date DESC);