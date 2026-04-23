CREATE OR REPLACE FUNCTION public.get_all_warehouse_location_companies()
RETURNS TABLE (location_id uuid, company_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT wlc.location_id, wlc.company_id
  FROM warehouse_location_companies wlc
  WHERE has_role(auth.uid(), 'admin')
     OR has_role(auth.uid(), 'super_admin')
     OR is_super_admin(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_all_warehouse_location_companies() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_all_companies_minimal()
RETURNS TABLE (id uuid, name text, code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.code FROM companies c
  WHERE has_role(auth.uid(), 'admin')
     OR has_role(auth.uid(), 'super_admin')
     OR is_super_admin(auth.uid())
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_companies_minimal() TO authenticated;