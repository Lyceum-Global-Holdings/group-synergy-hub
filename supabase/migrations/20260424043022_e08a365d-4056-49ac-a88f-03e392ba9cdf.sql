-- Add warehouse_tools to realtime publication and ensure full row payloads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'warehouse_tools'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouse_tools';
  END IF;
END $$;

ALTER TABLE public.warehouse_tools REPLICA IDENTITY FULL;
ALTER TABLE public.warehouse_items REPLICA IDENTITY FULL;