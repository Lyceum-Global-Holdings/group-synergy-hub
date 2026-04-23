CREATE OR REPLACE FUNCTION public.enforce_item_category_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_depth int := 0;
  v_cursor uuid := NEW.parent_id;
BEGIN
  IF NEW.parent_id IS NOT NULL AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Category cannot be its own parent';
  END IF;

  -- Walk up; reject cycles and depth > 1 (root=0, child=1)
  WHILE v_cursor IS NOT NULL LOOP
    IF v_cursor = NEW.id THEN
      RAISE EXCEPTION 'Move would create a cycle in category tree';
    END IF;
    v_depth := v_depth + 1;
    IF v_depth > 1 THEN
      RAISE EXCEPTION 'Category hierarchy is limited to 2 levels (Level 0 and Level 1)';
    END IF;
    SELECT parent_id INTO v_cursor FROM public.item_categories WHERE id = v_cursor;
  END LOOP;

  -- If this category itself has children, it must remain at Level 0
  IF NEW.parent_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.item_categories WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'Cannot move a parent category under another category (would exceed 2 levels)';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_item_category_hierarchy ON public.item_categories;

CREATE TRIGGER trg_item_category_hierarchy
BEFORE INSERT OR UPDATE OF parent_id ON public.item_categories
FOR EACH ROW EXECUTE FUNCTION public.enforce_item_category_hierarchy();