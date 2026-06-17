CREATE OR REPLACE FUNCTION public.prevent_empty_material_return_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'returned'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NOT EXISTS (
       SELECT 1
       FROM public.material_return_items mri
       WHERE mri.mrn_id = NEW.id
     ) THEN
    RAISE EXCEPTION 'Cannot approve material return note without return items'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_empty_material_return_approval ON public.material_return_notes;
CREATE TRIGGER trg_prevent_empty_material_return_approval
BEFORE UPDATE OF status ON public.material_return_notes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_empty_material_return_approval();