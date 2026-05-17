
-- 1. Add is_shared flag to warehouse_bins
ALTER TABLE public.warehouse_bins
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.warehouse_bins.is_shared IS
  'When true, the bin is a multi-owner (shared) storage bin per SAP EWM "Party Entitled to Dispose" model. warehouse_bins.company_id is the operator; warehouse_bin_allocations.company_id is the stock owner and may differ.';

-- 2. Relax company parity trigger: only force company when bin is single-owner
CREATE OR REPLACE FUNCTION public.enforce_bin_allocation_location_parity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_bin_location uuid;
  v_bin_company  uuid;
  v_is_shared    boolean;
BEGIN
  IF NEW.bin_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT location_id, company_id, is_shared
    INTO v_bin_location, v_bin_company, v_is_shared
  FROM public.warehouse_bins
  WHERE id = NEW.bin_id;

  -- Location parity is always strict (SAP EWM storage-bin discipline)
  IF v_bin_location IS NOT NULL THEN
    NEW.location_id := v_bin_location;
  END IF;

  -- Company parity only applies to single-owner bins.
  -- Shared bins keep the caller-supplied owner (Party Entitled to Dispose).
  IF COALESCE(v_is_shared, false) = false AND v_bin_company IS NOT NULL THEN
    NEW.company_id := v_bin_company;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Validation trigger: for shared bins, require caller can access the owner company
CREATE OR REPLACE FUNCTION public.validate_bin_allocation_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bin_location uuid;
  v_bin_company  uuid;
  v_is_shared    boolean;
  v_item_company uuid;
BEGIN
  SELECT company_id INTO v_item_company
  FROM public.warehouse_items
  WHERE id = NEW.warehouse_item_id;

  SELECT location_id, company_id, is_shared
    INTO v_bin_location, v_bin_company, v_is_shared
  FROM public.warehouse_bins
  WHERE id = NEW.bin_id;

  IF v_bin_location IS NULL THEN
    RAISE EXCEPTION 'Bin % has no location_id; cannot allocate stock', NEW.bin_id USING ERRCODE = '23502';
  END IF;

  -- Force allocation to the bin's exact physical node.
  NEW.location_id := v_bin_location;

  IF COALESCE(v_is_shared, false) THEN
    -- Shared bin: owner = item's company (each warehouse_items row is per-company).
    NEW.company_id := COALESCE(NEW.company_id, v_item_company);
    IF NEW.company_id IS NULL THEN
      RAISE EXCEPTION 'company_id (stock owner) is required for shared bin allocation' USING ERRCODE = '23502';
    END IF;
    -- Item must belong to the declared owner.
    IF v_item_company IS NOT NULL AND NEW.company_id <> v_item_company THEN
      RAISE EXCEPTION 'Stock owner (%) must match the item owner (%) for shared bin %',
        NEW.company_id, v_item_company, NEW.bin_id USING ERRCODE = '23514';
    END IF;
  ELSE
    -- Single-owner bin: owner forced to bin operator (legacy behavior).
    NEW.company_id := COALESCE(v_bin_company, NEW.company_id, v_item_company);
    IF NEW.company_id IS NULL THEN
      RAISE EXCEPTION 'company_id is required for bin allocation' USING ERRCODE = '23502';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Cascade trigger: never overwrite owner on shared bins
CREATE OR REPLACE FUNCTION public.cascade_bin_relocation_to_allocations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.location_id IS DISTINCT FROM OLD.location_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.is_shared  IS DISTINCT FROM OLD.is_shared THEN

    IF COALESCE(NEW.is_shared, false) THEN
      -- Shared bin: only cascade location (operator change must not rewrite stock owners).
      UPDATE public.warehouse_bin_allocations
      SET location_id = NEW.location_id
      WHERE bin_id = NEW.id
        AND location_id IS DISTINCT FROM NEW.location_id;
    ELSE
      -- Single-owner bin: cascade both location and owner company.
      UPDATE public.warehouse_bin_allocations
      SET location_id = NEW.location_id,
          company_id  = COALESCE(NEW.company_id, company_id)
      WHERE bin_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. RPC: toggle shared flag (admin of bin's operator company, or super_admin)
CREATE OR REPLACE FUNCTION public.set_bin_sharing(_bin_id uuid, _is_shared boolean)
RETURNS public.warehouse_bins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bin public.warehouse_bins;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_bin FROM public.warehouse_bins WHERE id = _bin_id;
  IF v_bin.id IS NULL THEN
    RAISE EXCEPTION 'Bin % not found', _bin_id USING ERRCODE = 'P0002';
  END IF;

  -- Authorization: super_admin OR admin of the bin's operator company
  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR (
      v_bin.company_id IS NOT NULL
      AND public.can_access_company(v_bin.company_id)
      AND public.has_role(v_uid, 'admin'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Only admins of the bin''s operator company can change sharing' USING ERRCODE = '42501';
  END IF;

  UPDATE public.warehouse_bins
  SET is_shared = _is_shared,
      updated_at = now()
  WHERE id = _bin_id
  RETURNING * INTO v_bin;

  RETURN v_bin;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_bin_sharing(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bin_sharing(uuid, boolean) TO authenticated;

-- 6. RPC: add allocation into a shared bin for a specific owner company
CREATE OR REPLACE FUNCTION public.add_shared_bin_allocation(
  _bin_id uuid,
  _warehouse_item_id uuid,
  _owner_company_id uuid,
  _quantity numeric,
  _notes text DEFAULT NULL
)
RETURNS public.warehouse_bin_allocations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bin   public.warehouse_bins;
  v_item  public.warehouse_items;
  v_alloc public.warehouse_bin_allocations;
  v_uid   uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF _quantity IS NULL OR _quantity < 0 THEN
    RAISE EXCEPTION 'Quantity must be >= 0' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_bin FROM public.warehouse_bins WHERE id = _bin_id;
  IF v_bin.id IS NULL THEN
    RAISE EXCEPTION 'Bin % not found', _bin_id USING ERRCODE = 'P0002';
  END IF;
  IF NOT COALESCE(v_bin.is_shared, false) THEN
    RAISE EXCEPTION 'Bin % is not a shared (multi-owner) bin', _bin_id USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item FROM public.warehouse_items WHERE id = _warehouse_item_id;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Warehouse item % not found', _warehouse_item_id USING ERRCODE = 'P0002';
  END IF;
  IF v_item.company_id <> _owner_company_id THEN
    RAISE EXCEPTION 'Item % does not belong to owner company %', _warehouse_item_id, _owner_company_id USING ERRCODE = '23514';
  END IF;

  IF NOT public.can_access_company(_owner_company_id) THEN
    RAISE EXCEPTION 'Not authorized to allocate stock for company %', _owner_company_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.warehouse_bin_allocations AS a
    (warehouse_item_id, bin_id, company_id, location_id, allocated_quantity, reserved_quantity, notes, created_by)
  VALUES
    (_warehouse_item_id, _bin_id, _owner_company_id, v_bin.location_id, _quantity, 0, _notes, v_uid)
  ON CONFLICT (warehouse_item_id, bin_id, company_id, location_id)
    WHERE location_id IS NOT NULL
  DO UPDATE SET
    allocated_quantity = a.allocated_quantity + EXCLUDED.allocated_quantity,
    notes = COALESCE(EXCLUDED.notes, a.notes),
    updated_at = now()
  RETURNING * INTO v_alloc;

  RETURN v_alloc;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_shared_bin_allocation(uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_shared_bin_allocation(uuid, uuid, uuid, numeric, text) TO authenticated;

-- 7. Helpful index for per-bin owner roll-ups
CREATE INDEX IF NOT EXISTS idx_warehouse_bin_allocations_bin_company
  ON public.warehouse_bin_allocations (bin_id, company_id)
  WHERE allocated_quantity > 0;
