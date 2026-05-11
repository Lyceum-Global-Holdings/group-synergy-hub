
CREATE INDEX IF NOT EXISTS idx_warehouse_bin_allocations_company_bin
  ON public.warehouse_bin_allocations (company_id, bin_id);

CREATE OR REPLACE FUNCTION public.get_public_bin_allocation_qr(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', a.id,
    'item_code', i.item_code,
    'item_name', i.name,
    'bin_code', b.bin_code,
    'bin_name', b.name,
    'location_name', l.name,
    'location_code', l.location_code,
    'company_name', c.name,
    'allocated_quantity', a.allocated_quantity,
    'available_quantity', a.available_quantity,
    'updated_at', a.updated_at
  )
  FROM public.warehouse_bin_allocations a
  JOIN public.warehouse_items i ON i.id = a.warehouse_item_id
  JOIN public.warehouse_bins b ON b.id = a.bin_id
  LEFT JOIN public.warehouse_locations l ON l.id = b.location_id
  LEFT JOIN public.companies c ON c.id = a.company_id
  WHERE a.id = p_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_bin_allocation_qr(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_bin_allocation_qr(uuid) TO anon, authenticated;
