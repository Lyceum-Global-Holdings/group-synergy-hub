-- Tool units: preserve the tool type's declared total_quantity as the physical
-- count (the cap for how many units can be serialized). Previously the recompute
-- overwrote total_quantity with the unit count, which made a registration cap
-- impossible. Now total_quantity is kept, and available/issued are derived from
-- unit statuses: issued = units currently issued; unavailable = issued + in
-- repair/calibration/retired/lost; available = total − unavailable.

CREATE OR REPLACE FUNCTION public.recompute_tool_counts(p_tool_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.warehouse_tools t
     SET issued_quantity    = sub.issued,
         available_quantity = GREATEST(t.total_quantity - sub.issued - sub.oos, 0),
         updated_at         = now()
    FROM (
      SELECT COUNT(*) FILTER (WHERE status = 'issued') AS issued,
             COUNT(*) FILTER (WHERE status IN ('in_repair','in_calibration','retired','lost')) AS oos
      FROM public.tool_units WHERE tool_id = p_tool_id
    ) sub
   WHERE t.id = p_tool_id AND t.is_serialized = true;
END;
$$;
