-- Drop and recreate the function to include location IDs
DROP FUNCTION IF EXISTS get_public_asset(uuid);

CREATE OR REPLACE FUNCTION get_public_asset(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', wa.id,
    'name', wa.name,
    'category', COALESCE(cat.name, 'Uncategorized'),
    'subcategory', subcat.name,
    'brand', wa.brand,
    'asset_id', wa.asset_id,
    'serial_number', wa.serial_number,
    'asset_tag', wa.asset_tag,
    'condition', wa.condition,
    'status', wa.status,
    'purchase_date', wa.purchase_date,
    'description', wa.description,
    'notes', wa.notes,
    'location', loc.name,
    'sublocation', subloc.name,
    'department', dept.name,
    'location_id', wa.location_id,
    'sublocation_id', wa.sublocation_id,
    'department_id', wa.department_id,
    'asset_age_years', EXTRACT(YEAR FROM age(CURRENT_DATE, wa.purchase_date))::int,
    'asset_age_months', EXTRACT(MONTH FROM age(CURRENT_DATE, wa.purchase_date))::int
  ) INTO result
  FROM warehouse_assets wa
  LEFT JOIN asset_categories cat ON wa.category_id = cat.id
  LEFT JOIN asset_categories subcat ON wa.subcategory_id = subcat.id
  LEFT JOIN warehouse_locations loc ON wa.location_id = loc.id
  LEFT JOIN warehouse_locations subloc ON wa.sublocation_id = subloc.id
  LEFT JOIN warehouse_locations dept ON wa.department_id = dept.id
  WHERE wa.id = p_id;
  
  RETURN result;
END;
$$;