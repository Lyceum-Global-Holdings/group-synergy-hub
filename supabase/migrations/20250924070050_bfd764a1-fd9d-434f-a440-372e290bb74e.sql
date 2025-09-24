-- Add warehouse_item_id field to link BOM products to inventory items
ALTER TABLE public.bill_of_materials 
ADD COLUMN warehouse_item_id uuid REFERENCES public.warehouse_items(id);

-- Add indexes for better performance on the new relationships
CREATE INDEX IF NOT EXISTS idx_bom_warehouse_item ON public.bill_of_materials(warehouse_item_id);
CREATE INDEX IF NOT EXISTS idx_bom_po ON public.bill_of_materials(po_id);

-- Add pr_id field to purchase_orders for better linking
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS pr_id uuid REFERENCES public.purchase_requisitions(id);

-- Add bom_id field to purchase_requisitions for linking PRs to BOMs
ALTER TABLE public.purchase_requisitions 
ADD COLUMN IF NOT EXISTS bom_id uuid REFERENCES public.bill_of_materials(id);

-- Add indexes for the new relationships
CREATE INDEX IF NOT EXISTS idx_po_pr ON public.purchase_orders(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_bom ON public.purchase_requisitions(bom_id);