-- Create a SECURITY DEFINER function to expose only safe public asset fields
CREATE OR REPLACE FUNCTION public.get_public_asset(p_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT to_jsonb(t)
  FROM (
    SELECT 
      id,
      name,
      category,
      brand,
      asset_id,
      serial_number,
      asset_tag,
      condition,
      status,
      purchase_date,
      purchase_price,
      current_value,
      description,
      notes
    FROM public.warehouse_assets
    WHERE id = p_id
    LIMIT 1
  ) AS t;
$$;

-- Grant execute to anon so unauthenticated users can call it (for QR code public view)
GRANT EXECUTE ON FUNCTION public.get_public_asset(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_asset(uuid) TO authenticated;