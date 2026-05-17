GRANT EXECUTE ON FUNCTION public.list_warehouse_inventory(
  uuid, text, uuid, text, uuid[], timestamptz, uuid, integer, text, uuid
) TO supabase_read_only_user;