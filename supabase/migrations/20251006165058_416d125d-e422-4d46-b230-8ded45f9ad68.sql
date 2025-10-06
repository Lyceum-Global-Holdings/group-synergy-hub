-- Add warehouse_item_id and supplier_item_id to supplier_evaluations for multi-item tracking
ALTER TABLE public.supplier_evaluations
ADD COLUMN warehouse_item_id UUID REFERENCES public.warehouse_items(id),
ADD COLUMN supplier_item_id UUID REFERENCES public.supplier_items(id);

-- Create index for performance
CREATE INDEX idx_supplier_evaluations_warehouse_item ON public.supplier_evaluations(warehouse_item_id);
CREATE INDEX idx_supplier_evaluations_supplier_item ON public.supplier_evaluations(supplier_item_id);

-- Add warehouse_item_id to supplier_evaluation_entries for item-level tracking
ALTER TABLE public.supplier_evaluation_entries
ADD COLUMN warehouse_item_id UUID REFERENCES public.warehouse_items(id);

-- Create index for performance
CREATE INDEX idx_supplier_evaluation_entries_warehouse_item ON public.supplier_evaluation_entries(warehouse_item_id);

-- Update the comment to reflect the multi-item capability
COMMENT ON TABLE public.supplier_evaluations IS 'Supplier evaluation records with multi-item support for monthly performance tracking';