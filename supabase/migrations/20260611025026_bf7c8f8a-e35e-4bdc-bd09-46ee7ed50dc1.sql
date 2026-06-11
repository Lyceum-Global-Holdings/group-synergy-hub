UPDATE public.grn_items
SET item_code = 'INV-ELC-000-0534',
    item_name = 'Cable | Sierra - CU/PVC/PVC | 1 Core | 7/1.04 mm-Earth cable '
WHERE grn_id = (SELECT id FROM public.goods_receipt_notes WHERE grn_number='GRN-20260611-001')
  AND item_name = 'INV-ELC-000-0534';