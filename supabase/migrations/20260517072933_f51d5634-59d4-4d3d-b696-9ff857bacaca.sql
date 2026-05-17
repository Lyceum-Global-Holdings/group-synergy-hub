UPDATE public.warehouse_locations
   SET parent_id               = NULL,
       company_id              = '11a46626-34c8-4ea8-8cc1-df0ec439fd48',
       type                    = 'warehouse',
       is_standalone_warehouse = true,
       updated_at              = now()
 WHERE id = 'a7d67f4c-7b06-4ce1-904c-a6097c0641a1';