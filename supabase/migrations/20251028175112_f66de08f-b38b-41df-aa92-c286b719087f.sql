-- Fix BOM duplication error by replacing unsafe trigger/function
-- 1) Drop any existing triggers on bill_of_materials that call validate_new_bom_linkage
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tg.tgname
    FROM pg_trigger tg
    JOIN pg_proc p ON tg.tgfoid = p.oid
    JOIN pg_class c ON tg.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'bill_of_materials'
      AND p.proname = 'validate_new_bom_linkage'
      AND NOT tg.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.bill_of_materials;', r.tgname);
  END LOOP;
END $$;

-- 2) Drop the old function if it exists
DROP FUNCTION IF EXISTS public.validate_new_bom_linkage() CASCADE;

-- 3) Create a safe version of the function that avoids referencing non-existent columns
CREATE OR REPLACE FUNCTION public.validate_new_bom_linkage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  -- Access NEW as JSONB to avoid compile-time field references
  new_json jsonb := to_jsonb(NEW);
  fg_id_text text := NULL;
BEGIN
  -- Safely extract finished_good_id if present (works even if column doesn't exist)
  fg_id_text := new_json ->> 'finished_good_id';

  -- If a finished_good_id is present, optional validations could go here.
  -- We intentionally do not reference NEW.finished_good_id directly.
  -- Example placeholder:
  -- IF fg_id_text IS NOT NULL THEN
  --   -- Add validation logic if/when the column is reintroduced
  -- END IF;

  RETURN NEW;
END;
$$;

-- 4) Recreate a single trigger using the safe function
CREATE TRIGGER bom_new_linkage_validation
BEFORE INSERT ON public.bill_of_materials
FOR EACH ROW
EXECUTE FUNCTION public.validate_new_bom_linkage();