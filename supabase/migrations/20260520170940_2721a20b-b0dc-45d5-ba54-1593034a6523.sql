CREATE OR REPLACE FUNCTION public.validate_warehouse_location_hierarchy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_row public.warehouse_locations%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.type := 'warehouse';
  ELSE
    SELECT * INTO parent_row FROM public.warehouse_locations WHERE id = NEW.parent_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parent location % does not exist', NEW.parent_id; END IF;
    IF parent_row.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Sub-locations cannot be nested. Parent is already a sub-location.';
    END IF;
    IF NEW.type NOT IN ('sublocation','department') THEN NEW.type := 'sublocation'; END IF;
    -- Inherit parent's company when not explicitly set, BEFORE validation
    IF NEW.company_id IS NULL THEN
      NEW.company_id := parent_row.company_id;
    END IF;
    -- Only enforce match when both sides have an explicit company
    IF parent_row.company_id IS NOT NULL
       AND NEW.company_id IS NOT NULL
       AND NEW.company_id <> parent_row.company_id THEN
      RAISE EXCEPTION 'Sub-location company must match parent warehouse company';
    END IF;
  END IF;
  RETURN NEW;
END $$;