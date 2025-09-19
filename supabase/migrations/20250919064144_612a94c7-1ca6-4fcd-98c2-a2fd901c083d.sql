-- Remove overly permissive public SELECT policy and restrict public access to RPC only
DROP POLICY IF EXISTS "Public can view basic asset information for QR codes" ON public.warehouse_assets;

-- Update RPC to exclude financial fields from public response
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
      description,
      notes
    FROM public.warehouse_assets
    WHERE id = p_id
    LIMIT 1
  ) AS t;
$function$;