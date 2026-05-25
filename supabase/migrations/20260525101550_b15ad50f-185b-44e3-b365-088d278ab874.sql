REVOKE ALL ON FUNCTION public.list_warehouse_catalog(text, text, uuid, uuid, timestamptz, uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_warehouse_catalog(text, text, uuid, uuid, timestamptz, uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_warehouse_catalog(text, text, uuid, uuid, timestamptz, uuid, int) TO authenticated;