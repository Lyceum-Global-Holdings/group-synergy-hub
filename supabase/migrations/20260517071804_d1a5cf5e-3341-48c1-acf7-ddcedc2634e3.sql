UPDATE public.warehouse_locations
   SET parent_id               = '6508ac11-b2d1-47ea-aa9f-c4fadde44c28',
       company_id              = '1c918a89-2370-4c10-aa07-3da6e8305d7d',
       type                    = 'sublocation',
       is_standalone_warehouse = false,
       updated_at              = now()
 WHERE id = 'a7d67f4c-7b06-4ce1-904c-a6097c0641a1';