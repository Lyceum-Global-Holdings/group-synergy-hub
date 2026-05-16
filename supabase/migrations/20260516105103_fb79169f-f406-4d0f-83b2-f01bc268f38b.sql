
-- 1) Stop forcing bins to the root warehouse.
-- Bins now stay at the exact node (warehouse, sub-location, or department/sub-space) the user selected.
-- root_location_id is kept as a derived helper for reporting only.
CREATE OR REPLACE FUNCTION public.warehouse_bins_set_root()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.location_id IS NOT NULL THEN
    NEW.root_location_id := public.get_root_location_id(NEW.location_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Tighten allocation validation to require EXACT node match with the bin.
-- Removes the legacy "same root warehouse" loophole.
CREATE OR REPLACE FUNCTION public.validate_bin_allocation_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bin_location uuid;
  v_bin_company  uuid;
  v_item_company uuid;
BEGIN
  SELECT company_id INTO v_item_company
  FROM public.warehouse_items
  WHERE id = NEW.warehouse_item_id;

  NEW.company_id := COALESCE(NEW.company_id, v_item_company);
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for bin allocation' USING ERRCODE = '23502';
  END IF;

  SELECT location_id, company_id
    INTO v_bin_location, v_bin_company
  FROM public.warehouse_bins
  WHERE id = NEW.bin_id;

  IF v_bin_location IS NULL THEN
    RAISE EXCEPTION 'Bin % has no location_id; cannot allocate stock', NEW.bin_id USING ERRCODE = '23502';
  END IF;

  -- Force allocation to the bin's exact physical node (SAP EWM storage-bin discipline).
  NEW.location_id := v_bin_location;

  RETURN NEW;
END;
$function$;

-- 3) Optional sub-bin support (SAP EWM "Bin Position" / Oracle locator slot).
-- Schema only; child bin inherits the parent bin's location_id.
ALTER TABLE public.warehouse_bins
  ADD COLUMN IF NOT EXISTS parent_bin_id uuid REFERENCES public.warehouse_bins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS warehouse_bins_parent_bin_idx ON public.warehouse_bins(parent_bin_id);

CREATE OR REPLACE FUNCTION public.warehouse_bins_inherit_parent_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent_loc uuid;
  v_parent_company uuid;
BEGIN
  IF NEW.parent_bin_id IS NOT NULL THEN
    SELECT location_id, company_id INTO v_parent_loc, v_parent_company
    FROM public.warehouse_bins WHERE id = NEW.parent_bin_id;
    IF v_parent_loc IS NULL THEN
      RAISE EXCEPTION 'Parent bin % has no location_id', NEW.parent_bin_id USING ERRCODE = '23502';
    END IF;
    NEW.location_id := v_parent_loc;
    IF v_parent_company IS NOT NULL THEN
      NEW.company_id := v_parent_company;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_warehouse_bins_inherit_parent ON public.warehouse_bins;
CREATE TRIGGER trg_warehouse_bins_inherit_parent
BEFORE INSERT OR UPDATE OF parent_bin_id, location_id ON public.warehouse_bins
FOR EACH ROW EXECUTE FUNCTION public.warehouse_bins_inherit_parent_location();

-- 4) Exact-node bin lookup for write-path pickers (no ancestor inheritance).
CREATE OR REPLACE FUNCTION public.list_bins_at_location(p_location_id uuid)
RETURNS TABLE(
  id uuid,
  bin_code text,
  name text,
  bin_type_id uuid,
  location_id uuid,
  status text,
  capacity numeric,
  current_quantity numeric,
  company_id uuid,
  parent_bin_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT b.id, b.bin_code, b.name, b.bin_type_id, b.location_id,
         b.status, b.capacity, b.current_quantity, b.company_id, b.parent_bin_id
  FROM public.warehouse_bins b
  WHERE b.location_id = p_location_id
    AND COALESCE(b.status, 'active') = 'active'
  ORDER BY b.bin_code;
$function$;

-- 5) Repair unambiguous existing data:
-- Move bins that are currently parked at the root warehouse but whose
-- stock_transactions history shows a single distinct sub-location node.
WITH evidence AS (
  SELECT b.id AS bin_id,
         b.location_id AS current_loc,
         b.root_location_id AS root_loc,
         (SELECT array_agg(DISTINCT st.location_id)
            FROM public.stock_transactions st
            WHERE st.bin_id = b.id
              AND st.location_id IS NOT NULL
              AND st.location_id <> b.root_location_id) AS distinct_sub_locs
  FROM public.warehouse_bins b
  WHERE b.location_id = b.root_location_id
)
UPDATE public.warehouse_bins b
SET location_id = e.distinct_sub_locs[1]
FROM evidence e
WHERE b.id = e.bin_id
  AND e.distinct_sub_locs IS NOT NULL
  AND array_length(e.distinct_sub_locs, 1) = 1
  AND e.distinct_sub_locs[1] <> b.root_location_id;
-- Cascade trigger then realigns warehouse_bin_allocations.
