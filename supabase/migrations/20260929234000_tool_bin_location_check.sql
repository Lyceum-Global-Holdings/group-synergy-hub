-- Tools: the legacy tool-bin mirror no longer blocks stock movements.
--
-- Tool stock lives in warehouse_bin_allocations; a trigger copies every change
-- into tool_bin_allocations for the tool detail panel. A check on that copy
-- refused any bin whose location wasn't exactly the tool's location (a
-- sub-location or its parent warehouse didn't count), and since the check runs
-- before an existing row is updated, one mismatch made every later issue,
-- return, allocation, move or adjustment of that tool fail with "Bin location
-- does not match tool location".
--
-- Now:
--   • a bin anywhere in the tool's warehouse (the same root location) is fine;
--   • a bin in another warehouse is accepted too — the stock is there — and
--     the tool's location follows it when the tool holds nothing left in its
--     current warehouse;
--   • a tool with no location still takes the bin's; a bin with no location is
--     still refused (fix the bin).
--
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION public.validate_tool_bin_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tool_location uuid;
  v_tool_root uuid;
  v_bin_location uuid;
  v_bin_root uuid;
BEGIN
  SELECT location_id INTO v_tool_location FROM public.warehouse_tools WHERE id = NEW.tool_id;
  SELECT location_id, COALESCE(root_location_id, public.get_root_location_id(location_id))
    INTO v_bin_location, v_bin_root
    FROM public.warehouse_bins WHERE id = NEW.bin_id;

  IF v_bin_location IS NULL THEN
    RAISE EXCEPTION 'Bin has no location assigned. Configure the bin location first.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- No location yet: the tool takes the bin's.
  IF v_tool_location IS NULL THEN
    UPDATE public.warehouse_tools SET location_id = v_bin_location, updated_at = now() WHERE id = NEW.tool_id;
    RETURN NEW;
  END IF;

  IF v_tool_location = v_bin_location THEN RETURN NEW; END IF;

  -- Same warehouse, any node (warehouse, bay, sub-location): fine.
  v_tool_root := public.get_root_location_id(v_tool_location);
  IF v_tool_root = v_bin_root THEN RETURN NEW; END IF;

  -- Another warehouse: the stock is in that bin, so accept it; the tool moves
  -- there once it has nothing left where it was.
  IF NOT EXISTS (
    SELECT 1 FROM public.tool_bin_allocations a
      JOIN public.warehouse_bins b ON b.id = a.bin_id
     WHERE a.tool_id = NEW.tool_id
       AND a.bin_id <> NEW.bin_id
       AND a.allocated_quantity > 0
       AND COALESCE(b.root_location_id, public.get_root_location_id(b.location_id)) = v_tool_root
  ) THEN
    UPDATE public.warehouse_tools SET location_id = v_bin_location, updated_at = now() WHERE id = NEW.tool_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying — tools whose stock sits in another warehouse
-- than the tool's own (these no longer fail; listed for information):
--   SELECT t.tool_code, t.name, tl.name AS tool_location, b.bin_code, bl.name AS bin_location, a.allocated_quantity
--     FROM public.warehouse_tools t
--     JOIN public.tool_bin_allocations a ON a.tool_id = t.id
--     JOIN public.warehouse_bins b ON b.id = a.bin_id
--     LEFT JOIN public.warehouse_locations tl ON tl.id = t.location_id
--     LEFT JOIN public.warehouse_locations bl ON bl.id = b.location_id
--    WHERE public.get_root_location_id(t.location_id) IS DISTINCT FROM COALESCE(b.root_location_id, public.get_root_location_id(b.location_id))
--    ORDER BY t.tool_code;
-- ─────────────────────────────────────────────────────────────────────────────
