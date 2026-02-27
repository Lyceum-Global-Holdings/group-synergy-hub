-- Ensure every user with a primary company has authoritative membership in user_company_access
-- This prevents missing-data issues in company-scoped modules/RLS for newly created users.

-- 1) Backfill existing users missing their primary company membership
INSERT INTO public.user_company_access (user_id, company_id, access_type, created_by)
SELECT
  p.user_id,
  p.company_id,
  'full',
  COALESCE(auth.uid(), p.user_id)
FROM public.profiles p
WHERE p.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = p.user_id
      AND uca.company_id = p.company_id
  );

-- 2) Keep future profile changes in sync automatically
CREATE OR REPLACE FUNCTION public.ensure_primary_company_access_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.company_id IS NOT NULL THEN
    INSERT INTO public.user_company_access (user_id, company_id, access_type, created_by)
    SELECT
      NEW.user_id,
      NEW.company_id,
      'full',
      COALESCE(auth.uid(), NEW.user_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = NEW.user_id
        AND uca.company_id = NEW.company_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_ensure_primary_company_access
ON public.profiles;

CREATE TRIGGER trg_profiles_ensure_primary_company_access
AFTER INSERT OR UPDATE OF company_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_primary_company_access_from_profile();