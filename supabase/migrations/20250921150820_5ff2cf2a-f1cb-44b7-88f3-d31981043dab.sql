-- Create stock transaction types enum
CREATE TYPE stock_transaction_type AS ENUM (
  'opening_stock',
  'goods_receipt', 
  'material_issue',
  'material_return',
  'adjustment',
  'transfer_in',
  'transfer_out'
);

-- Create reference types enum  
CREATE TYPE stock_reference_type AS ENUM (
  'manual',
  'grn',
  'mrn', 
  'adjustment',
  'transfer'
);

-- Create stock_transactions table
CREATE TABLE public.stock_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL,
  transaction_type stock_transaction_type NOT NULL,
  reference_type stock_reference_type NOT NULL,
  reference_id UUID,
  quantity_change NUMERIC NOT NULL,
  quantity_before NUMERIC NOT NULL DEFAULT 0,
  quantity_after NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC,
  total_value NUMERIC,
  notes TEXT,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view stock transactions"
ON public.stock_transactions FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create stock transactions"
ON public.stock_transactions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update transactions they created or admins can update any"
ON public.stock_transactions FOR UPDATE  
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete stock transactions"
ON public.stock_transactions FOR DELETE
USING (is_admin(auth.uid()));

-- Create function to update current stock automatically
CREATE OR REPLACE FUNCTION public.update_item_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the current_stock in warehouse_items
  UPDATE public.warehouse_items
  SET current_stock = NEW.quantity_after,
      updated_at = now()
  WHERE id = NEW.item_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically update stock
CREATE TRIGGER update_item_stock_trigger
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_item_stock();

-- Create updated_at trigger for stock_transactions
CREATE TRIGGER update_stock_transactions_updated_at
  BEFORE UPDATE ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();