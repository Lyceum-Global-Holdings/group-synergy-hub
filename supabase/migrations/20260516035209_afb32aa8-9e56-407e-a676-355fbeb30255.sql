
ALTER TABLE public.warehouse_bins DROP CONSTRAINT IF EXISTS warehouse_bins_bin_code_location_id_key;

CREATE OR REPLACE FUNCTION public.get_root_location_id(_location_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  cur uuid := _location_id;
  par uuid;
  i int := 0;
BEGIN
  IF cur IS NULL THEN RETURN NULL; END IF;
  LOOP
    SELECT parent_id INTO par FROM public.warehouse_locations WHERE id = cur;
    IF NOT FOUND OR par IS NULL THEN RETURN cur; END IF;
    cur := par;
    i := i + 1;
    IF i > 10 THEN RETURN cur; END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.warehouse_bins
  ADD COLUMN IF NOT EXISTS root_location_id uuid REFERENCES public.warehouse_locations(id);

UPDATE public.warehouse_bins b
SET root_location_id = public.get_root_location_id(b.location_id)
WHERE b.location_id IS NOT NULL AND b.root_location_id IS NULL;

DO $$
DECLARE
  dup RECORD;
  keep_id uuid;
  drop_ids uuid[];
BEGIN
  FOR dup IN
    SELECT bin_code, company_id, root_location_id,
           array_agg(id ORDER BY (location_id = root_location_id) DESC, created_at ASC) AS ids
    FROM public.warehouse_bins
    WHERE root_location_id IS NOT NULL
    GROUP BY bin_code, company_id, root_location_id
    HAVING COUNT(*) > 1
  LOOP
    keep_id := dup.ids[1];
    drop_ids := dup.ids[2:array_length(dup.ids,1)];

    WITH consolidated AS (
      SELECT warehouse_item_id,
             SUM(allocated_quantity) AS qty,
             SUM(COALESCE(reserved_quantity,0)) AS res,
             SUM(COALESCE(secondary_quantity,0)) AS sec
      FROM public.warehouse_bin_allocations
      WHERE bin_id = ANY(drop_ids)
      GROUP BY warehouse_item_id
    ),
    upserted AS (
      UPDATE public.warehouse_bin_allocations a
      SET allocated_quantity = a.allocated_quantity + c.qty,
          reserved_quantity = COALESCE(a.reserved_quantity,0) + c.res,
          secondary_quantity = COALESCE(a.secondary_quantity,0) + c.sec,
          updated_at = now()
      FROM consolidated c
      WHERE a.bin_id = keep_id AND a.warehouse_item_id = c.warehouse_item_id
      RETURNING a.warehouse_item_id
    )
    INSERT INTO public.warehouse_bin_allocations
      (warehouse_item_id, bin_id, allocated_quantity, reserved_quantity, secondary_quantity, company_id)
    SELECT c.warehouse_item_id, keep_id, c.qty, c.res, c.sec, dup.company_id
    FROM consolidated c
    WHERE c.warehouse_item_id NOT IN (SELECT warehouse_item_id FROM upserted);

    DELETE FROM public.warehouse_bin_allocations WHERE bin_id = ANY(drop_ids);
    UPDATE public.tool_bin_allocations SET bin_id = keep_id WHERE bin_id = ANY(drop_ids);
    DELETE FROM public.warehouse_bins WHERE id = ANY(drop_ids);
  END LOOP;
END $$;

UPDATE public.warehouse_bins
SET location_id = root_location_id
WHERE root_location_id IS NOT NULL AND location_id <> root_location_id;

DROP INDEX IF EXISTS public.warehouse_bins_code_company_location_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_bins_code_company_root_uniq
  ON public.warehouse_bins (bin_code, company_id, root_location_id)
  WHERE company_id IS NOT NULL AND root_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS warehouse_bins_root_lookup_idx
  ON public.warehouse_bins (company_id, root_location_id, bin_code);

CREATE OR REPLACE FUNCTION public.warehouse_bins_set_root()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.location_id IS NOT NULL THEN
    NEW.root_location_id := public.get_root_location_id(NEW.location_id);
    NEW.location_id := NEW.root_location_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warehouse_bins_set_root ON public.warehouse_bins;
CREATE TRIGGER trg_warehouse_bins_set_root
BEFORE INSERT OR UPDATE OF location_id ON public.warehouse_bins
FOR EACH ROW EXECUTE FUNCTION public.warehouse_bins_set_root();

CREATE OR REPLACE FUNCTION public.bulk_clone_bin_scope(
  _bin_ids uuid[],
  _company_ids uuid[],
  _location_ids uuid[],
  _mode text DEFAULT 'clone',
  _global boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_created int := 0;
  v_deleted int := 0;
  v_skipped jsonb := '[]'::jsonb;
  rec RECORD;
  src RECORD;
  v_existing uuid;
  v_alloc_count int;
  v_root uuid;
BEGIN
  IF NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'Only admins can change bin scope';
  END IF;

  IF _bin_ids IS NULL OR array_length(_bin_ids,1) = 0 THEN
    RAISE EXCEPTION 'No source bins selected';
  END IF;

  FOR src IN SELECT * FROM public.warehouse_bins WHERE id = ANY(_bin_ids) LOOP
    FOR rec IN
      SELECT c.id AS company_id, l.id AS location_id
      FROM unnest(_company_ids) c(id)
      CROSS JOIN unnest(_location_ids) l(id)
      JOIN public.warehouse_locations wl ON wl.id = l.id AND wl.parent_id IS NULL
    LOOP
      v_root := rec.location_id;
      SELECT id INTO v_existing
      FROM public.warehouse_bins
      WHERE bin_code = src.bin_code
        AND company_id = rec.company_id
        AND root_location_id = v_root
      LIMIT 1;

      IF v_existing IS NULL THEN
        INSERT INTO public.warehouse_bins
          (bin_code, name, description, capacity, bin_type_id, status, notes,
           company_id, location_id, is_global_template, created_by)
        VALUES
          (src.bin_code, src.name, src.description, src.capacity, src.bin_type_id, src.status, src.notes,
           rec.company_id, v_root, COALESCE(_global, src.is_global_template), v_uid);
        v_created := v_created + 1;
      END IF;
    END LOOP;

    IF _mode = 'replace' THEN
      FOR rec IN
        SELECT id FROM public.warehouse_bins
        WHERE bin_code = src.bin_code
          AND NOT (company_id = ANY(_company_ids) AND root_location_id = ANY(_location_ids))
      LOOP
        SELECT COUNT(*) INTO v_alloc_count FROM public.warehouse_bin_allocations WHERE bin_id = rec.id;
        IF v_alloc_count > 0 THEN
          v_skipped := v_skipped || jsonb_build_object('bin_id', rec.id, 'reason', 'has_stock');
        ELSE
          DELETE FROM public.warehouse_bins WHERE id = rec.id;
          v_deleted := v_deleted + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  INSERT INTO public.security_audit_log (user_id, action, resource_type, details)
  VALUES (v_uid, 'bulk_bin_scope_change', 'warehouse_bins',
    jsonb_build_object('bin_ids', _bin_ids, 'companies', _company_ids,
                       'locations', _location_ids, 'mode', _mode,
                       'created', v_created, 'deleted', v_deleted, 'skipped', v_skipped));

  RETURN jsonb_build_object('created', v_created, 'deleted', v_deleted, 'skipped', v_skipped);
END;
$$;
