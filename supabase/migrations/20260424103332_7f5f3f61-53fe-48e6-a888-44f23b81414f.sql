CREATE OR REPLACE FUNCTION public.enforce_item_category_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_depth int := 0;
  v_cursor uuid := NEW.parent_id;
  v_subtree_height int := 0;
BEGIN
  -- Self-parent guard
  IF NEW.parent_id IS NOT NULL AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Category cannot be its own parent';
  END IF;

  -- Walk up ancestors: reject cycles and ancestor depth > 2 (root=0, child=1, grandchild=2)
  WHILE v_cursor IS NOT NULL LOOP
    IF v_cursor = NEW.id THEN
      RAISE EXCEPTION 'Move would create a cycle in category tree';
    END IF;
    v_depth := v_depth + 1;
    IF v_depth > 2 THEN
      RAISE EXCEPTION 'Category hierarchy is limited to 3 levels (Level 0, Level 1, Level 2)';
    END IF;
    SELECT parent_id INTO v_cursor FROM public.item_categories WHERE id = v_cursor;
  END LOOP;

  -- Descendant-aware move check: subtree below NEW must not exceed depth 2 overall.
  -- v_depth here = depth of NEW itself (0 if root, 1 if child, 2 if grandchild).
  IF NEW.parent_id IS NOT NULL THEN
    WITH RECURSIVE descendants AS (
      SELECT id, 1 AS rel_depth
      FROM public.item_categories
      WHERE parent_id = NEW.id
      UNION ALL
      SELECT c.id, d.rel_depth + 1
      FROM public.item_categories c
      JOIN descendants d ON c.parent_id = d.id
    )
    SELECT COALESCE(MAX(rel_depth), 0) INTO v_subtree_height FROM descendants;

    IF v_depth + v_subtree_height > 2 THEN
      RAISE EXCEPTION 'Move would exceed the 3-level category limit (Level 0, Level 1, Level 2)';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_item_category_hierarchy ON public.item_categories;

CREATE TRIGGER trg_item_category_hierarchy
BEFORE INSERT OR UPDATE OF parent_id ON public.item_categories
FOR EACH ROW EXECUTE FUNCTION public.enforce_item_category_hierarchy();