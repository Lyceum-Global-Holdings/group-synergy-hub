REVOKE EXECUTE ON FUNCTION public.get_min_returnable_lines(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_min_returnable_lines(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_min_returnable_lines(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_min_returnable_lines(uuid) TO service_role;