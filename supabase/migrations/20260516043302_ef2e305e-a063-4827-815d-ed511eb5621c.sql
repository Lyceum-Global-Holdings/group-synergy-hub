CREATE OR REPLACE FUNCTION public.get_location_subtree_ids(p_location_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT id FROM public.warehouse_locations WHERE id = p_location_id
    UNION ALL
    SELECT child.id
    FROM public.warehouse_locations child
    JOIN tree t ON child.parent_id = t.id
  )
  SELECT id FROM tree;
$$;

REVOKE ALL ON FUNCTION public.get_location_subtree_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_location_subtree_ids(uuid) TO authenticated;