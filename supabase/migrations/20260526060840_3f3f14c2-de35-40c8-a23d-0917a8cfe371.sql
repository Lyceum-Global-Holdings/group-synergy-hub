CREATE OR REPLACE FUNCTION public.validate_srn_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _exists boolean;
BEGIN
  IF NEW.srn_number IS NULL OR NEW.srn_number = '' THEN
    NEW.srn_number := NULL;
    RETURN NEW;
  END IF;

  -- Uniqueness check across the three header tables (per company)
  IF NEW.company_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.material_requests
       WHERE company_id = NEW.company_id AND srn_number = NEW.srn_number
         AND id <> NEW.id
      UNION ALL
      SELECT 1 FROM public.material_issue_notes
       WHERE company_id = NEW.company_id AND srn_number = NEW.srn_number
         AND id <> NEW.id
      UNION ALL
      SELECT 1 FROM public.material_return_notes
       WHERE company_id = NEW.company_id AND srn_number = NEW.srn_number
         AND id <> NEW.id
    ) INTO _exists;

    IF _exists THEN
      RAISE EXCEPTION 'SRN number % already exists for this company', NEW.srn_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;