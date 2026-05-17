
-- Ensure each "live" warehouse table has REPLICA IDENTITY FULL + is in supabase_realtime publication.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'warehouse_items',
    'warehouse_bin_allocations',
    'warehouse_bins',
    'warehouse_item_catalog',
    'stock_transactions',
    'stock_transfer_requests',
    'warehouse_locations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Skip if table does not exist (defensive)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Guard function: returns list of tables missing realtime coverage.
CREATE OR REPLACE FUNCTION public.verify_realtime_coverage()
RETURNS TABLE(table_name text, issue text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected text[] := ARRAY[
    'warehouse_items',
    'warehouse_bin_allocations',
    'warehouse_bins',
    'warehouse_item_catalog',
    'stock_transactions',
    'stock_transfer_requests',
    'warehouse_locations'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      table_name := t; issue := 'not in supabase_realtime publication'; RETURN NEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname='public' AND c.relname=t AND c.relreplident='f'
       ) THEN
      table_name := t; issue := 'replica identity is not FULL'; RETURN NEXT;
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.verify_realtime_coverage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_realtime_coverage() TO authenticated, service_role;
