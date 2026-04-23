-- Clear any warehouse_tools.category_id that does not exist in item_categories
UPDATE public.warehouse_tools wt
SET category_id = NULL
WHERE category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.item_categories ic WHERE ic.id = wt.category_id
  );

ALTER TABLE public.warehouse_tools
  DROP CONSTRAINT IF EXISTS warehouse_tools_category_id_fkey;

ALTER TABLE public.warehouse_tools
  ADD CONSTRAINT warehouse_tools_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;