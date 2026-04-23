-- 1. Add snapshot columns to tool_issues for audit preservation
ALTER TABLE public.tool_issues
  ADD COLUMN IF NOT EXISTS tool_code_snapshot text,
  ADD COLUMN IF NOT EXISTS tool_name_snapshot text;

-- Backfill snapshots for existing rows
UPDATE public.tool_issues ti
SET tool_code_snapshot = wt.tool_code,
    tool_name_snapshot = wt.name
FROM public.warehouse_tools wt
WHERE ti.tool_id = wt.id
  AND (ti.tool_code_snapshot IS NULL OR ti.tool_name_snapshot IS NULL);

-- Trigger to populate snapshot columns on insert/update
CREATE OR REPLACE FUNCTION public.populate_tool_issue_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tool_id IS NOT NULL THEN
    SELECT tool_code, name
      INTO NEW.tool_code_snapshot, NEW.tool_name_snapshot
    FROM public.warehouse_tools
    WHERE id = NEW.tool_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_tool_issue_snapshot ON public.tool_issues;
CREATE TRIGGER trg_populate_tool_issue_snapshot
  BEFORE INSERT OR UPDATE OF tool_id ON public.tool_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_tool_issue_snapshot();

-- 2. Make tool_id nullable and switch FK to SET NULL (preserves history)
ALTER TABLE public.tool_issues ALTER COLUMN tool_id DROP NOT NULL;
ALTER TABLE public.tool_issues DROP CONSTRAINT IF EXISTS tool_issues_tool_id_fkey;
ALTER TABLE public.tool_issues
  ADD CONSTRAINT tool_issues_tool_id_fkey
  FOREIGN KEY (tool_id) REFERENCES public.warehouse_tools(id) ON DELETE SET NULL;

-- 3. Replace permissive DELETE policy on warehouse_tools with admin-only policy
DROP POLICY IF EXISTS "Users can delete warehouse tools" ON public.warehouse_tools;

CREATE POLICY "Admins can delete warehouse tools"
ON public.warehouse_tools
FOR DELETE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role)
   OR public.has_role(auth.uid(), 'super_admin'::app_role))
  AND (company_id IS NULL OR public.can_access_company(company_id))
);

-- 4. Trigger: block delete when units are still issued (not yet returned)
CREATE OR REPLACE FUNCTION public.prevent_tool_delete_with_active_issues()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  outstanding numeric;
BEGIN
  SELECT COALESCE(SUM(quantity_issued - quantity_returned), 0)
    INTO outstanding
  FROM public.tool_issues
  WHERE tool_id = OLD.id
    AND quantity_issued > quantity_returned;

  IF outstanding > 0 THEN
    RAISE EXCEPTION 'Cannot delete tool: % unit(s) are still issued. Process returns first.', outstanding
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tool_delete_with_active_issues ON public.warehouse_tools;
CREATE TRIGGER trg_prevent_tool_delete_with_active_issues
  BEFORE DELETE ON public.warehouse_tools
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tool_delete_with_active_issues();