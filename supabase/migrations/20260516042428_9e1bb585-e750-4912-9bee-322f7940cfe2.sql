REVOKE EXECUTE ON FUNCTION public.get_location_subtree_ids(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_subtree_bin_ids(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_company_inventory_at_location(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamp with time zone, uuid, integer, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_location_subtree_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subtree_bin_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_inventory_at_location(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamp with time zone, uuid, integer, text) TO authenticated;