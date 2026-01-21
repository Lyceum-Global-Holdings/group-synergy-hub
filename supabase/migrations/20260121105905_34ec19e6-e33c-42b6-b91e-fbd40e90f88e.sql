-- Drop and recreate the get_public_asset function to include location data
CREATE OR REPLACE FUNCTION public.get_public_asset(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(t)
  FROM (
    SELECT 
      wa.id,
      wa.name,
      COALESCE(cat.name, wa.category) as category,
      subcat.name as subcategory,
      wa.brand,
      wa.asset_id,
      wa.serial_number,
      wa.asset_tag,
      wa.condition,
      wa.status,
      wa.purchase_date,
      wa.description,
      wa.notes,
      loc.name as location,
      subloc.name as sublocation,
      dept.name as department,
      -- Calculate asset age in years and months
      CASE 
        WHEN wa.purchase_date IS NOT NULL THEN
          EXTRACT(YEAR FROM age(CURRENT_DATE, wa.purchase_date))::int
        ELSE NULL
      END as asset_age_years,
      CASE 
        WHEN wa.purchase_date IS NOT NULL THEN
          EXTRACT(MONTH FROM age(CURRENT_DATE, wa.purchase_date))::int
        ELSE NULL
      END as asset_age_months
    FROM public.warehouse_assets wa
    LEFT JOIN public.warehouse_locations loc ON wa.location_id = loc.id
    LEFT JOIN public.warehouse_locations subloc ON wa.sublocation_id = subloc.id
    LEFT JOIN public.warehouse_locations dept ON wa.department_id = dept.id
    LEFT JOIN public.asset_categories cat ON wa.category_id = cat.id
    LEFT JOIN public.asset_categories subcat ON wa.subcategory_id = subcat.id
    WHERE wa.id = p_id
    LIMIT 1
  ) AS t;
$function$;