-- Restore the deleted Power Tools (TOO-PWR) Level 0 category and re-parent orphans
DO $$
DECLARE
  v_pwr_id uuid;
BEGIN
  -- Insert if missing (global, level 0)
  SELECT id INTO v_pwr_id
  FROM public.item_categories
  WHERE code = 'TOO-PWR' AND company_id IS NULL AND parent_id IS NULL;

  IF v_pwr_id IS NULL THEN
    INSERT INTO public.item_categories (code, name, description, parent_id, company_id)
    VALUES ('TOO-PWR', 'Power Tools', 'Power-operated tools (drills, saws, grinders, etc.)', NULL, NULL)
    RETURNING id INTO v_pwr_id;
  END IF;

  -- Re-parent any TOO-PWR-* orphans (parent_id is NULL but code indicates child of Power Tools)
  UPDATE public.item_categories
  SET parent_id = v_pwr_id
  WHERE code LIKE 'TOO-PWR-%'
    AND parent_id IS NULL
    AND id <> v_pwr_id;
END $$;