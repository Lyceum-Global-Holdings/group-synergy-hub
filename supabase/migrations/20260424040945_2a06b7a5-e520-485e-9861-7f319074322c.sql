ALTER TABLE public.warehouse_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouse_items;