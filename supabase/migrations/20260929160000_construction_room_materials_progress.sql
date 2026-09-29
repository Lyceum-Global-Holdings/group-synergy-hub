-- Construction: room materials through issue notes, and project progress.
--
-- 1. Room issues go through a Material Issue Note. Requesting materials for a
--    room creates and submits a MIN from one of the project's warehouses (its
--    allocated locations or its own location), which reserves bin stock; an
--    admin approves it and the store issues it as for any MIN, taking stock from
--    bins. When the MIN is issued, the room's issued quantities and history are
--    updated. Returning from a room creates a Material Return Note against the
--    MIN it was issued on, back to the bin it came from; approving it reduces
--    the room's issued quantity. The old direct issue/return, which changed the
--    item total outside the bins and had no approval, is refused.
-- 2. Project progress is calculated: each room is the average of its stages
--    (a completed stage counts as 100%), the project the average of its rooms
--    that have stages. Stages now take their company from the project, so the
--    people of that company can see and edit them (they were saved without one).
--
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Links
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.material_issue_notes
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.construction_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.floor_drawing_rooms(id) ON DELETE SET NULL;
ALTER TABLE public.material_issue_items
  ADD COLUMN IF NOT EXISTS room_material_id uuid REFERENCES public.floor_room_materials(id) ON DELETE SET NULL;
ALTER TABLE public.material_return_items
  ADD COLUMN IF NOT EXISTS room_material_id uuid REFERENCES public.floor_room_materials(id) ON DELETE SET NULL;
ALTER TABLE public.floor_room_material_transactions
  ADD COLUMN IF NOT EXISTS min_id uuid,
  ADD COLUMN IF NOT EXISTS mrn_id uuid;

CREATE INDEX IF NOT EXISTS idx_material_issue_notes_room ON public.material_issue_notes(room_id) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_material_issue_items_room_material ON public.material_issue_items(room_material_id) WHERE room_material_id IS NOT NULL;

-- Room → project (via its floor drawing).
CREATE OR REPLACE FUNCTION public.room_project(p_room_id uuid)
RETURNS public.construction_projects
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.* FROM public.floor_drawing_rooms r
    JOIN public.project_floor_drawings d ON d.id = r.floor_drawing_id
    JOIN public.construction_projects p ON p.id = d.project_id
   WHERE r.id = p_room_id
$$;

-- The project's warehouses: allocated locations, or its own location.
CREATE OR REPLACE FUNCTION public.project_warehouse_ids(p_project_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.warehouse_location_id FROM public.project_warehouse_allocations a WHERE a.project_id = p_project_id
  UNION
  SELECT p.location_id FROM public.construction_projects p WHERE p.id = p_project_id AND p.location_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.location_tree_ids(p_location_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE t AS (
    SELECT id FROM public.warehouse_locations WHERE id = p_location_id
    UNION
    SELECT l.id FROM public.warehouse_locations l JOIN t ON l.parent_id = t.id
  )
  SELECT id FROM t
$$;

-- The warehouses a room's materials can come from (for the request form).
CREATE OR REPLACE FUNCTION public.room_warehouse_options(p_room_id uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.id, l.name
    FROM public.warehouse_locations l
   WHERE l.id IN (SELECT public.project_warehouse_ids((public.room_project(p_room_id)).id))
     AND public.can_access_company((public.room_project(p_room_id)).company_id)
   ORDER BY l.name
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Request room materials → submitted MIN
-- ─────────────────────────────────────────────────────────────────────────────
-- p_lines: [{room_material_id, quantity}]
CREATE OR REPLACE FUNCTION public.request_room_materials(
  p_room_id uuid,
  p_location_id uuid,
  p_lines jsonb,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project public.construction_projects%ROWTYPE;
  v_room public.floor_drawing_rooms%ROWTYPE;
  v_line jsonb;
  v_rm public.floor_room_materials%ROWTYPE;
  v_qty numeric;
  v_open numeric;
  v_item public.warehouse_items%ROWTYPE;
  v_min uuid;
  v_n integer := 0;
BEGIN
  SELECT * INTO v_room FROM public.floor_drawing_rooms WHERE id = p_room_id;
  v_project := public.room_project(p_room_id);
  IF v_room.id IS NULL OR v_project.id IS NULL THEN
    RAISE EXCEPTION 'Room not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_access_company(v_project.company_id) OR NOT public.has_construction_access(v_uid) THEN
    RAISE EXCEPTION 'You can''t request materials for this project' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_warehouse_ids(v_project.id)) THEN
    RAISE EXCEPTION 'Allocate a warehouse to project % first', v_project.project_name;
  END IF;
  IF p_location_id IS NULL OR p_location_id NOT IN (SELECT public.project_warehouse_ids(v_project.id)) THEN
    RAISE EXCEPTION 'Materials must come from one of the project''s warehouses';
  END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Choose at least one material';
  END IF;

  INSERT INTO public.material_issue_notes (min_number, issue_date, issued_to, department, purpose, job_number,
                                           location_id, company_id, created_by, requested_by, status, notes,
                                           project_id, room_id)
  VALUES (public.generate_min_number(), CURRENT_DATE,
          left(v_project.project_name || ' / ' || v_room.room_name, 200), 'Construction',
          'Materials for ' || v_room.room_name, v_project.project_code,
          p_location_id, v_project.company_id, v_uid, v_uid, 'draft', NULLIF(btrim(COALESCE(p_notes, '')), ''),
          v_project.id, v_room.id)
  RETURNING id INTO v_min;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_rm FROM public.floor_room_materials WHERE id = NULLIF(v_line->>'room_material_id', '')::uuid;
    IF NOT FOUND OR v_rm.room_id <> p_room_id THEN RAISE EXCEPTION 'That material isn''t planned for this room'; END IF;
    v_qty := COALESCE(NULLIF(v_line->>'quantity', '')::numeric, 0);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Enter a quantity above zero'; END IF;

    -- Planned minus issued minus what is already on open issue notes.
    IF COALESCE(v_rm.quantity_required, 0) > 0 THEN
      v_open := v_rm.quantity_required - COALESCE(v_rm.quantity_allocated, 0) - COALESCE((
        SELECT SUM(i.quantity_issued) FROM public.material_issue_items i
          JOIN public.material_issue_notes n ON n.id = i.min_id
         WHERE i.room_material_id = v_rm.id AND n.status IN ('draft', 'pending_approval', 'approved')), 0);
      IF v_qty > v_open THEN
        RAISE EXCEPTION 'Only % more is planned for this room (planned % , issued or requested %)',
          greatest(v_open, 0), v_rm.quantity_required, v_rm.quantity_required - greatest(v_open, 0);
      END IF;
    END IF;

    -- The stock row at the chosen warehouse (same catalogue item).
    SELECT wi.* INTO v_item FROM public.warehouse_items wi
     WHERE wi.id = v_rm.warehouse_item_id AND wi.location_id IN (SELECT public.location_tree_ids(p_location_id));
    IF NOT FOUND THEN
      SELECT wi.* INTO v_item FROM public.warehouse_items wi
        JOIN public.warehouse_items src ON src.id = v_rm.warehouse_item_id AND src.catalog_item_id = wi.catalog_item_id
       WHERE wi.location_id IN (SELECT public.location_tree_ids(p_location_id))
       ORDER BY COALESCE(wi.current_stock, 0) DESC
       LIMIT 1;
    END IF;
    IF v_item.id IS NULL THEN
      RAISE EXCEPTION '% isn''t stocked at that warehouse',
        COALESCE((SELECT f.name FROM public.warehouse_items_full f WHERE f.id = v_rm.warehouse_item_id), 'This material');
    END IF;

    v_n := v_n + 1;
    INSERT INTO public.material_issue_items (min_id, item_id, line_number, item_code, description, purpose,
                                             quantity_required, quantity_issued, unit_cost, total_cost, room_material_id)
    SELECT v_min, v_item.id, v_n, f.item_code, f.name, 'Room ' || v_room.room_name, v_qty, v_qty,
           COALESCE(v_item.unit_cost, v_rm.unit_cost, 0), v_qty * COALESCE(v_item.unit_cost, v_rm.unit_cost, 0), v_rm.id
      FROM public.warehouse_items_full f WHERE f.id = v_item.id;
    v_item := NULL;
  END LOOP;

  -- Submits and reserves bin stock, like any MIN.
  PERFORM public.submit_material_issue_for_approval(v_min);
  RETURN v_min;
END;
$$;

-- When a room's MIN is issued, the room records what it received.
CREATE OR REPLACE FUNCTION public.record_room_issue()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it record;
BEGIN
  IF NEW.status = 'issued' AND OLD.status IS DISTINCT FROM 'issued' AND NEW.room_id IS NOT NULL THEN
    FOR it IN
      SELECT i.*, rm.quantity_allocated AS before_qty
        FROM public.material_issue_items i
        JOIN public.floor_room_materials rm ON rm.id = i.room_material_id
       WHERE i.min_id = NEW.id
    LOOP
      UPDATE public.floor_room_materials
         SET quantity_allocated = COALESCE(quantity_allocated, 0) + it.quantity_issued,
             status = CASE WHEN status = 'planned' THEN 'allocated' ELSE status END,
             updated_at = now()
       WHERE id = it.room_material_id;
      INSERT INTO public.floor_room_material_transactions (room_material_id, warehouse_item_id, room_id, transaction_type,
        quantity, previous_quantity, new_quantity, unit_cost, total_value, notes, performed_by, company_id, min_id)
      VALUES (it.room_material_id, it.item_id, NEW.room_id, 'issue', it.quantity_issued,
              COALESCE(it.before_qty, 0), COALESCE(it.before_qty, 0) + it.quantity_issued,
              it.unit_cost, it.total_cost, 'Issued on ' || NEW.min_number, COALESCE(NEW.issued_by, auth.uid()),
              NEW.company_id, NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_room_issue ON public.material_issue_notes;
CREATE TRIGGER trg_record_room_issue
  AFTER UPDATE OF status ON public.material_issue_notes
  FOR EACH ROW EXECUTE FUNCTION public.record_room_issue();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Return from a room → MRN against the MIN it was issued on
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.return_room_material(
  p_room_material_id uuid,
  p_quantity numeric,
  p_condition text DEFAULT 'good',
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rm public.floor_room_materials%ROWTYPE;
  v_project public.construction_projects%ROWTYPE;
  v_src record;
  v_bin uuid;
  v_mrn public.material_return_notes%ROWTYPE;
  v_name text;
BEGIN
  SELECT * INTO v_rm FROM public.floor_room_materials WHERE id = p_room_material_id;
  v_project := public.room_project(v_rm.room_id);
  IF v_rm.id IS NULL OR v_project.id IS NULL THEN RAISE EXCEPTION 'Room material not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_access_company(v_project.company_id) OR NOT public.has_construction_access(v_uid) THEN
    RAISE EXCEPTION 'You can''t return materials for this project' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_quantity, 0) <= 0 THEN RAISE EXCEPTION 'Enter a quantity above zero'; END IF;
  IF p_condition NOT IN ('good', 'damaged', 'expired') THEN RAISE EXCEPTION 'Condition must be good, damaged or expired'; END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Give a reason for the return'; END IF;

  -- The latest issue note this material came on with enough still returnable.
  SELECT n.id AS min_id, n.location_id, i.item_id, i.unit_cost,
         i.quantity_issued - COALESCE((
           SELECT SUM(ri.quantity_returned) FROM public.material_return_items ri
             JOIN public.material_return_notes r ON r.id = ri.mrn_id
            WHERE r.reference_type = 'material_issue' AND r.reference_id = n.id
              AND ri.item_id = i.item_id AND r.status <> 'cancelled'), 0) AS returnable
    INTO v_src
    FROM public.material_issue_items i
    JOIN public.material_issue_notes n ON n.id = i.min_id
   WHERE i.room_material_id = v_rm.id AND n.status IN ('issued', 'partially_received', 'completed')
   ORDER BY (i.quantity_issued - COALESCE((
           SELECT SUM(ri.quantity_returned) FROM public.material_return_items ri
             JOIN public.material_return_notes r ON r.id = ri.mrn_id
            WHERE r.reference_type = 'material_issue' AND r.reference_id = n.id
              AND ri.item_id = i.item_id AND r.status <> 'cancelled'), 0)) >= p_quantity DESC,
            n.issue_date DESC, n.created_at DESC
   LIMIT 1;
  IF v_src.min_id IS NULL THEN
    RAISE EXCEPTION 'Nothing of this material was issued to the room through an issue note';
  END IF;
  IF p_quantity > v_src.returnable THEN
    RAISE EXCEPTION 'At most % can be returned at a time (what is left of its latest issue note)', greatest(v_src.returnable, 0);
  END IF;

  SELECT b.bin_id INTO v_bin FROM public.get_min_issued_bins(v_src.min_id, v_src.item_id) b ORDER BY b.quantity DESC LIMIT 1;
  SELECT COALESCE(full_name, email, 'Construction') INTO v_name FROM public.profiles WHERE user_id = v_uid;

  v_mrn := public.create_material_return_with_items(
    CURRENT_DATE, COALESCE(v_name, 'Construction'), 'internal', btrim(p_reason),
    'material_issue', v_src.min_id, NULL, v_project.company_id, NULL,
    jsonb_build_array(jsonb_build_object('item_id', v_src.item_id, 'quantity_returned', p_quantity, 'condition', p_condition,
                                         'unit_cost', COALESCE(v_src.unit_cost, 0), 'bin_id', v_bin)),
    v_src.location_id);
  UPDATE public.material_return_items SET room_material_id = v_rm.id WHERE mrn_id = v_mrn.id AND item_id = v_src.item_id;
  RETURN v_mrn.id;
END;
$$;

-- Approving the return reduces what the room holds.
CREATE OR REPLACE FUNCTION public.record_room_return()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it record;
BEGIN
  IF NEW.status = 'returned' AND OLD.status IS DISTINCT FROM 'returned' THEN
    FOR it IN
      SELECT ri.*, rm.room_id, rm.quantity_allocated AS before_qty
        FROM public.material_return_items ri
        JOIN public.floor_room_materials rm ON rm.id = ri.room_material_id
       WHERE ri.mrn_id = NEW.id
    LOOP
      UPDATE public.floor_room_materials
         SET quantity_allocated = GREATEST(COALESCE(quantity_allocated, 0) - it.quantity_returned, 0),
             status = CASE WHEN COALESCE(quantity_allocated, 0) - it.quantity_returned <= 0 THEN 'planned' ELSE status END,
             updated_at = now()
       WHERE id = it.room_material_id;
      INSERT INTO public.floor_room_material_transactions (room_material_id, warehouse_item_id, room_id, transaction_type,
        quantity, previous_quantity, new_quantity, unit_cost, total_value, notes, performed_by, company_id, mrn_id)
      VALUES (it.room_material_id, it.item_id, it.room_id, 'return', it.quantity_returned,
              COALESCE(it.before_qty, 0), GREATEST(COALESCE(it.before_qty, 0) - it.quantity_returned, 0),
              it.unit_cost, it.total_cost, 'Returned on ' || NEW.mrn_number, auth.uid(), NEW.company_id, NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_room_return ON public.material_return_notes;
CREATE TRIGGER trg_record_room_return
  AFTER UPDATE OF status ON public.material_return_notes
  FOR EACH ROW EXECUTE FUNCTION public.record_room_return();

-- The MIN / MRN already write the stock ledger; the room history must not add
-- a second (bin-less) entry. Direct issues and returns from the app are refused.
CREATE OR REPLACE FUNCTION public.create_stock_transaction_for_room_material()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.min_id IS NOT NULL OR NEW.mrn_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.transaction_type IN ('issue', 'return') AND NEW.warehouse_item_id IS NOT NULL THEN
    INSERT INTO stock_transactions (item_id, transaction_type, reference_type, reference_id, quantity_change,
      quantity_before, quantity_after, unit_cost, total_value, notes, company_id, created_by)
    VALUES (NEW.warehouse_item_id,
      CASE WHEN NEW.transaction_type = 'issue' THEN 'project_issue'::stock_transaction_type ELSE 'project_return'::stock_transaction_type END,
      'project'::stock_reference_type, NEW.id,
      CASE WHEN NEW.transaction_type = 'issue' THEN -NEW.quantity ELSE NEW.quantity END,
      COALESCE(NEW.previous_warehouse_stock, 0), COALESCE(NEW.new_warehouse_stock, 0), NEW.unit_cost, NEW.total_value,
      CASE WHEN NEW.transaction_type = 'issue' THEN 'Project Issue: ' || COALESCE(NEW.notes, 'Material issued to project')
           ELSE 'Project Return: ' || COALESCE(NEW.notes, 'Material returned from project') END,
      NEW.company_id, COALESCE(auth.uid(), NEW.performed_by));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_direct_room_stock_moves()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.transaction_type IN ('issue', 'return') THEN
    RAISE EXCEPTION 'Room materials are issued and returned through Material Issue and Return Notes' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_direct_room_stock_moves ON public.floor_room_material_transactions;
CREATE TRIGGER trg_block_direct_room_stock_moves
  BEFORE INSERT ON public.floor_room_material_transactions
  FOR EACH ROW EXECUTE FUNCTION public.block_direct_room_stock_moves();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Progress from room stages
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.room_progress(p_room_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT AVG(CASE WHEN s.status = 'completed' THEN 100 ELSE LEAST(GREATEST(COALESCE(s.completion_percentage, 0), 0), 100) END)
    FROM public.floor_room_stages s WHERE s.room_id = p_room_id
$$;

CREATE OR REPLACE FUNCTION public.refresh_project_progress(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pct numeric;
BEGIN
  SELECT AVG(x.p) INTO v_pct
    FROM (SELECT public.room_progress(r.id) AS p
            FROM public.floor_drawing_rooms r
            JOIN public.project_floor_drawings d ON d.id = r.floor_drawing_id
           WHERE d.project_id = p_project_id) x
   WHERE x.p IS NOT NULL;
  IF v_pct IS NOT NULL THEN
    UPDATE public.construction_projects
       SET completion_percentage = round(v_pct, 2), updated_at = now()
     WHERE id = p_project_id AND completion_percentage IS DISTINCT FROM round(v_pct, 2);
  END IF;
END;
$$;

-- Stages take the project's company, and a completed stage is 100%.
CREATE OR REPLACE FUNCTION public.prepare_room_stage()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (public.room_project(NEW.room_id)).company_id;
  END IF;
  IF NEW.status = 'completed' THEN
    NEW.completion_percentage := 100;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_room_stage ON public.floor_room_stages;
CREATE TRIGGER trg_prepare_room_stage
  BEFORE INSERT OR UPDATE ON public.floor_room_stages
  FOR EACH ROW EXECUTE FUNCTION public.prepare_room_stage();

CREATE OR REPLACE FUNCTION public.project_progress_from_stage()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_project uuid;
BEGIN
  v_project := (public.room_project(COALESCE(NEW.room_id, OLD.room_id))).id;
  IF v_project IS NOT NULL THEN
    PERFORM public.refresh_project_progress(v_project);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_project_progress_from_stage ON public.floor_room_stages;
CREATE TRIGGER trg_project_progress_from_stage
  AFTER INSERT OR UPDATE OR DELETE ON public.floor_room_stages
  FOR EACH ROW EXECUTE FUNCTION public.project_progress_from_stage();

-- Existing stages: give them their company, then calculate every project.
UPDATE public.floor_room_stages s
   SET company_id = (public.room_project(s.room_id)).company_id
 WHERE s.company_id IS NULL AND (public.room_project(s.room_id)).company_id IS NOT NULL;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.construction_projects LOOP
    PERFORM public.refresh_project_progress(r.id);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.request_room_materials(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_room_materials(uuid, uuid, jsonb, text) TO authenticated;
REVOKE ALL ON FUNCTION public.return_room_material(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_room_material(uuid, numeric, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.room_warehouse_options(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.room_warehouse_options(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.project_warehouse_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_warehouse_ids(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.refresh_project_progress(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.room_project(uuid) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN ('request_room_materials', 'return_room_material',
--        'refresh_project_progress', 'room_progress')) AS functions,  -- 4
--     (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_record_room_issue', 'trg_record_room_return',
--        'trg_block_direct_room_stock_moves', 'trg_prepare_room_stage', 'trg_project_progress_from_stage')) AS triggers,  -- 5
--     (SELECT count(*) FROM public.floor_room_stages WHERE company_id IS NULL) AS stages_without_company,  -- 0
--     (SELECT count(*) FROM public.construction_projects WHERE completion_percentage > 0) AS projects_with_progress;
-- ─────────────────────────────────────────────────────────────────────────────
