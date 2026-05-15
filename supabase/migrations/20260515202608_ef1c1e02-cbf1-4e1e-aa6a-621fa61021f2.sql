
-- Ensure cross-tenant uniqueness for bin code per (company, location)
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_bins_code_company_location_uniq
  ON public.warehouse_bins (bin_code, company_id, location_id)
  WHERE company_id IS NOT NULL AND location_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bulk_clone_bin_scope(
  _bin_ids uuid[],
  _company_ids uuid[],
  _location_ids uuid[],
  _mode text DEFAULT 'clone',
  _global boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_super boolean;
  v_created int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_deleted int := 0;
  src record;
  cid uuid;
  lid uuid;
  v_existing uuid;
  v_alloc_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.is_admin(v_uid);
  v_is_super := public.is_super_admin(v_uid);
  IF NOT (v_is_admin OR v_is_super) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  IF _bin_ids IS NULL OR array_length(_bin_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No source bins provided';
  END IF;
  IF _company_ids IS NULL OR array_length(_company_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No target companies provided';
  END IF;
  IF _location_ids IS NULL OR array_length(_location_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No target locations provided';
  END IF;
  IF _mode NOT IN ('clone','replace') THEN
    RAISE EXCEPTION 'Invalid mode: %', _mode;
  END IF;

  -- Cartesian product per source bin × company × location
  FOR src IN
    SELECT id, bin_code, name, bin_type_id, capacity, status, description, notes
    FROM public.warehouse_bins
    WHERE id = ANY(_bin_ids)
  LOOP
    FOREACH cid IN ARRAY _company_ids LOOP
      -- Tenant guard
      IF NOT public.can_access_company(cid) THEN
        v_skipped := v_skipped || jsonb_build_object(
          'bin_code', src.bin_code, 'company_id', cid, 'reason', 'no_company_access'
        );
        CONTINUE;
      END IF;

      FOREACH lid IN ARRAY _location_ids LOOP
        -- Skip if exact (bin_code, company, location) row already exists
        SELECT id INTO v_existing
          FROM public.warehouse_bins
         WHERE bin_code = src.bin_code
           AND company_id = cid
           AND location_id = lid
         LIMIT 1;

        IF v_existing IS NOT NULL THEN
          v_skipped := v_skipped || jsonb_build_object(
            'bin_code', src.bin_code, 'company_id', cid, 'location_id', lid, 'reason', 'exists'
          );
          CONTINUE;
        END IF;

        BEGIN
          INSERT INTO public.warehouse_bins (
            bin_code, name, bin_type_id, location_id, company_id,
            capacity, status, description, notes,
            is_global_template, created_by
          ) VALUES (
            src.bin_code, src.name, src.bin_type_id, lid, cid,
            src.capacity, src.status, src.description, src.notes,
            COALESCE(_global, false), v_uid
          );
          v_created := v_created + 1;
        EXCEPTION WHEN unique_violation THEN
          v_skipped := v_skipped || jsonb_build_object(
            'bin_code', src.bin_code, 'company_id', cid, 'location_id', lid, 'reason', 'conflict'
          );
        END;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Replace mode: remove rows with the same bin_code that fall outside the new scope and have no allocations
  IF _mode = 'replace' THEN
    FOR src IN
      SELECT DISTINCT bin_code FROM public.warehouse_bins WHERE id = ANY(_bin_ids)
    LOOP
      FOR v_existing IN
        SELECT b.id
          FROM public.warehouse_bins b
         WHERE b.bin_code = src.bin_code
           AND ( b.company_id IS NULL OR NOT (b.company_id = ANY(_company_ids))
                 OR b.location_id IS NULL OR NOT (b.location_id = ANY(_location_ids)) )
      LOOP
        SELECT COUNT(*) INTO v_alloc_count
          FROM public.warehouse_bin_allocations
         WHERE bin_id = v_existing;

        IF v_alloc_count > 0 THEN
          v_skipped := v_skipped || jsonb_build_object(
            'bin_id', v_existing, 'bin_code', src.bin_code, 'reason', 'has_stock'
          );
        ELSE
          DELETE FROM public.warehouse_bins WHERE id = v_existing;
          v_deleted := v_deleted + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Audit
  INSERT INTO public.security_audit_log (changed_by, action, after_value)
  VALUES (v_uid, 'bulk_bin_scope_change', jsonb_build_object(
    'bin_ids', _bin_ids,
    'company_ids', _company_ids,
    'location_ids', _location_ids,
    'mode', _mode,
    'global', _global,
    'created', v_created,
    'deleted', v_deleted,
    'skipped', v_skipped
  ));

  RETURN jsonb_build_object(
    'created', v_created,
    'deleted', v_deleted,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_clone_bin_scope(uuid[], uuid[], uuid[], text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.bulk_clone_bin_scope(uuid[], uuid[], uuid[], text, boolean) TO authenticated;
