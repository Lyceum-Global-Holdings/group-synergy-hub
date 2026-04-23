
-- ============================================================================
-- Tool Bin Allocations: bin-aware tool inventory mirroring warehouse_bin_allocations
-- ============================================================================

-- 1) New table tool_bin_allocations
CREATE TABLE IF NOT EXISTS public.tool_bin_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.warehouse_tools(id) ON DELETE CASCADE,
  bin_id uuid NOT NULL REFERENCES public.warehouse_bins(id) ON DELETE RESTRICT,
  allocated_quantity numeric NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
  reserved_quantity numeric NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity numeric GENERATED ALWAYS AS (allocated_quantity - reserved_quantity) STORED,
  notes text,
  company_id uuid REFERENCES public.companies(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tool_bin_allocations_tool_bin_unique UNIQUE (tool_id, bin_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_bin_allocations_tool ON public.tool_bin_allocations(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_bin_allocations_bin ON public.tool_bin_allocations(bin_id);
CREATE INDEX IF NOT EXISTS idx_tool_bin_allocations_company ON public.tool_bin_allocations(company_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_tool_bin_allocations_updated_at ON public.tool_bin_allocations;
CREATE TRIGGER trg_tool_bin_allocations_updated_at
  BEFORE UPDATE ON public.tool_bin_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) RLS
ALTER TABLE public.tool_bin_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tool bin allocations" ON public.tool_bin_allocations;
CREATE POLICY "Users can view tool bin allocations"
ON public.tool_bin_allocations
FOR SELECT
TO authenticated
USING (
  company_id IS NULL OR public.can_access_company(company_id)
);

DROP POLICY IF EXISTS "Users can insert tool bin allocations" ON public.tool_bin_allocations;
CREATE POLICY "Users can insert tool bin allocations"
ON public.tool_bin_allocations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (company_id IS NULL OR public.can_access_company(company_id))
);

DROP POLICY IF EXISTS "Users can update tool bin allocations" ON public.tool_bin_allocations;
CREATE POLICY "Users can update tool bin allocations"
ON public.tool_bin_allocations
FOR UPDATE
TO authenticated
USING (
  company_id IS NULL OR public.can_access_company(company_id)
);

DROP POLICY IF EXISTS "Admins can delete tool bin allocations" ON public.tool_bin_allocations;
CREATE POLICY "Admins can delete tool bin allocations"
ON public.tool_bin_allocations
FOR DELETE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role)
   OR public.has_role(auth.uid(), 'super_admin'::app_role))
  AND (company_id IS NULL OR public.can_access_company(company_id))
);

-- 3) Trigger: validate bin location matches tool location
CREATE OR REPLACE FUNCTION public.validate_tool_bin_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tool_location uuid;
  v_bin_location uuid;
BEGIN
  SELECT location_id INTO v_tool_location FROM public.warehouse_tools WHERE id = NEW.tool_id;
  SELECT location_id INTO v_bin_location FROM public.warehouse_bins WHERE id = NEW.bin_id;

  IF v_bin_location IS NULL THEN
    RAISE EXCEPTION 'Bin has no location assigned. Configure the bin location first.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- If tool has no location, adopt the bin's location
  IF v_tool_location IS NULL THEN
    UPDATE public.warehouse_tools SET location_id = v_bin_location WHERE id = NEW.tool_id;
  ELSIF v_tool_location <> v_bin_location THEN
    RAISE EXCEPTION 'Bin location does not match tool location. Move stock to a bin at the tool''s location.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tool_bin_location ON public.tool_bin_allocations;
CREATE TRIGGER trg_validate_tool_bin_location
  BEFORE INSERT OR UPDATE OF bin_id, tool_id ON public.tool_bin_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tool_bin_location();

-- 4) Trigger: sync warehouse_tools.total_quantity and available_quantity from bins
CREATE OR REPLACE FUNCTION public.sync_tool_total_from_bins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tool_id uuid;
  v_total numeric;
  v_issued numeric;
BEGIN
  v_tool_id := COALESCE(NEW.tool_id, OLD.tool_id);
  IF v_tool_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(allocated_quantity), 0) INTO v_total
    FROM public.tool_bin_allocations
   WHERE tool_id = v_tool_id;

  SELECT COALESCE(issued_quantity, 0) INTO v_issued
    FROM public.warehouse_tools
   WHERE id = v_tool_id;

  UPDATE public.warehouse_tools
     SET total_quantity = v_total,
         available_quantity = GREATEST(v_total - v_issued, 0),
         updated_at = now()
   WHERE id = v_tool_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tool_total_from_bins ON public.tool_bin_allocations;
CREATE TRIGGER trg_sync_tool_total_from_bins
  AFTER INSERT OR UPDATE OR DELETE ON public.tool_bin_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tool_total_from_bins();

-- 5) Add bin_id to tool_issues (nullable, FK SET NULL)
ALTER TABLE public.tool_issues
  ADD COLUMN IF NOT EXISTS bin_id uuid REFERENCES public.warehouse_bins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tool_issues_bin ON public.tool_issues(bin_id);

-- 6) Trigger: prevent changing tool location while bin allocations exist
CREATE OR REPLACE FUNCTION public.prevent_tool_location_change_with_bins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NEW.location_id IS DISTINCT FROM OLD.location_id THEN
    SELECT COUNT(*) INTO v_count
      FROM public.tool_bin_allocations
     WHERE tool_id = NEW.id;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Cannot change location while % bin allocation(s) exist. Move all stock to bins at the new location first.', v_count
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tool_location_change_with_bins ON public.warehouse_tools;
CREATE TRIGGER trg_prevent_tool_location_change_with_bins
  BEFORE UPDATE OF location_id ON public.warehouse_tools
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tool_location_change_with_bins();

-- ============================================================================
-- 7) RPC: issue_tool_from_bin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.issue_tool_from_bin(
  p_tool_id uuid,
  p_bin_id uuid,
  p_quantity numeric,
  p_issued_to_name text,
  p_issue_date date,
  p_department text DEFAULT NULL,
  p_expected_return_date date DEFAULT NULL,
  p_expected_return_time time DEFAULT NULL,
  p_purpose text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alloc_id uuid;
  v_available numeric;
  v_issue_id uuid;
  v_issue_number text;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  -- Lock the allocation row
  SELECT id, available_quantity INTO v_alloc_id, v_available
    FROM public.tool_bin_allocations
   WHERE tool_id = p_tool_id AND bin_id = p_bin_id
   FOR UPDATE;

  IF v_alloc_id IS NULL THEN
    RAISE EXCEPTION 'Selected bin has no allocation for this tool';
  END IF;

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient quantity in bin: % available, % requested', v_available, p_quantity
      USING ERRCODE = 'check_violation';
  END IF;

  -- Decrement bin allocation
  UPDATE public.tool_bin_allocations
     SET allocated_quantity = allocated_quantity - p_quantity,
         updated_at = now()
   WHERE id = v_alloc_id;

  -- Generate issue number
  v_issue_number := 'TI-' || upper(to_hex((extract(epoch from now())*1000)::bigint));

  -- Insert tool issue
  INSERT INTO public.tool_issues (
    tool_id, bin_id, issued_to_name, department, issue_date,
    expected_return_date, expected_return_time, quantity_issued,
    quantity_returned, purpose, notes, status, company_id, created_by, issue_number
  ) VALUES (
    p_tool_id, p_bin_id, p_issued_to_name, p_department, p_issue_date,
    p_expected_return_date, p_expected_return_time, p_quantity,
    0, p_purpose, p_notes, 'issued', p_company_id, v_user, v_issue_number
  ) RETURNING id INTO v_issue_id;

  -- Increment issued_quantity on tool master (total_quantity already synced by trigger)
  UPDATE public.warehouse_tools
     SET issued_quantity = COALESCE(issued_quantity, 0) + p_quantity,
         available_quantity = GREATEST(total_quantity - (COALESCE(issued_quantity, 0) + p_quantity), 0),
         updated_at = now()
   WHERE id = p_tool_id;

  RETURN v_issue_id;
END;
$$;

-- ============================================================================
-- 8) RPC: return_tool_to_bin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.return_tool_to_bin(
  p_issue_id uuid,
  p_bin_id uuid,
  p_quantity numeric,
  p_condition text,
  p_return_date date,
  p_returned_by_name text DEFAULT NULL,
  p_condition_notes text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_issue record;
  v_return_id uuid;
  v_return_number text;
  v_new_returned numeric;
  v_new_status text;
  v_alloc_exists uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  SELECT * INTO v_issue FROM public.tool_issues WHERE id = p_issue_id FOR UPDATE;
  IF v_issue IS NULL THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF p_quantity > (v_issue.quantity_issued - v_issue.quantity_returned) THEN
    RAISE EXCEPTION 'Cannot return more than outstanding quantity (%).', (v_issue.quantity_issued - v_issue.quantity_returned)
      USING ERRCODE = 'check_violation';
  END IF;

  v_return_number := 'TR-' || upper(to_hex((extract(epoch from now())*1000)::bigint));

  INSERT INTO public.tool_returns (
    issue_id, return_date, quantity_returned, condition, condition_notes,
    returned_by_name, notes, status, company_id, created_by, received_by, return_number
  ) VALUES (
    p_issue_id, p_return_date, p_quantity, p_condition, p_condition_notes,
    p_returned_by_name, p_notes, 'completed', p_company_id, v_user, v_user, v_return_number
  ) RETURNING id INTO v_return_id;

  v_new_returned := v_issue.quantity_returned + p_quantity;
  v_new_status := CASE WHEN v_new_returned >= v_issue.quantity_issued THEN 'returned' ELSE 'partially_returned' END;

  UPDATE public.tool_issues
     SET quantity_returned = v_new_returned,
         status = v_new_status,
         updated_at = now()
   WHERE id = p_issue_id;

  -- Restore stock to bin only when condition allows reuse
  IF p_condition IN ('good', 'needs_repair') AND v_issue.tool_id IS NOT NULL THEN
    -- Upsert bin allocation
    SELECT id INTO v_alloc_exists
      FROM public.tool_bin_allocations
     WHERE tool_id = v_issue.tool_id AND bin_id = p_bin_id
     FOR UPDATE;

    IF v_alloc_exists IS NULL THEN
      INSERT INTO public.tool_bin_allocations (tool_id, bin_id, allocated_quantity, company_id, created_by)
      VALUES (v_issue.tool_id, p_bin_id, p_quantity, p_company_id, v_user);
    ELSE
      UPDATE public.tool_bin_allocations
         SET allocated_quantity = allocated_quantity + p_quantity,
             updated_at = now()
       WHERE id = v_alloc_exists;
    END IF;
  END IF;

  -- Adjust tool master issued/total counts
  IF v_issue.tool_id IS NOT NULL THEN
    IF p_condition IN ('lost', 'damaged') THEN
      -- Reduce issued_quantity; total_quantity already reflects bins (which are unchanged)
      UPDATE public.warehouse_tools
         SET issued_quantity = GREATEST(COALESCE(issued_quantity, 0) - p_quantity, 0),
             available_quantity = GREATEST(total_quantity - GREATEST(COALESCE(issued_quantity, 0) - p_quantity, 0), 0),
             updated_at = now()
       WHERE id = v_issue.tool_id;
    ELSE
      -- good / needs_repair: bin trigger already recomputed total; just decrement issued
      UPDATE public.warehouse_tools
         SET issued_quantity = GREATEST(COALESCE(issued_quantity, 0) - p_quantity, 0),
             available_quantity = GREATEST(total_quantity - GREATEST(COALESCE(issued_quantity, 0) - p_quantity, 0), 0),
             updated_at = now()
       WHERE id = v_issue.tool_id;
    END IF;
  END IF;

  RETURN v_return_id;
END;
$$;

-- ============================================================================
-- 9) RPC: create_tool_with_initial_bin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_tool_with_initial_bin(
  p_tool_data jsonb,
  p_bin_id uuid,
  p_quantity numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tool_id uuid;
  v_company_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_company_id := NULLIF(p_tool_data->>'company_id', '')::uuid;

  INSERT INTO public.warehouse_tools (
    tool_code, name, description, category_id, location_id, unit_id,
    total_quantity, available_quantity, issued_quantity, condition,
    unit_cost, image_url, notes, company_id, created_by
  ) VALUES (
    COALESCE(p_tool_data->>'tool_code', 'TL-' || upper(to_hex((extract(epoch from now())*1000)::bigint))),
    p_tool_data->>'name',
    p_tool_data->>'description',
    NULLIF(p_tool_data->>'category_id','')::uuid,
    NULLIF(p_tool_data->>'location_id','')::uuid,
    NULLIF(p_tool_data->>'unit_id','')::uuid,
    0, 0, 0,
    COALESCE(p_tool_data->>'condition','good'),
    NULLIF(p_tool_data->>'unit_cost','')::numeric,
    p_tool_data->>'image_url',
    p_tool_data->>'notes',
    v_company_id,
    v_user
  ) RETURNING id INTO v_tool_id;

  IF p_bin_id IS NOT NULL AND p_quantity IS NOT NULL AND p_quantity > 0 THEN
    INSERT INTO public.tool_bin_allocations (tool_id, bin_id, allocated_quantity, company_id, created_by)
    VALUES (v_tool_id, p_bin_id, p_quantity, v_company_id, v_user);
    -- sync trigger updates totals
  END IF;

  RETURN v_tool_id;
END;
$$;

-- Realtime
ALTER TABLE public.tool_bin_allocations REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tool_bin_allocations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_bin_allocations';
  END IF;
END $$;
