
-- 1. Add public_qr surface to default Turnstile surfaces (preserve existing keys)
UPDATE public.security_settings
SET turnstile_surfaces = COALESCE(turnstile_surfaces, '{}'::jsonb)
                         || jsonb_build_object('public_qr', false)
WHERE id = 'global'
  AND NOT (COALESCE(turnstile_surfaces, '{}'::jsonb) ? 'public_qr');

-- 2. Lock down the public RPC: anon must go through the edge function
REVOKE EXECUTE ON FUNCTION public.get_public_bin_allocation_qr(uuid) FROM anon;
-- authenticated keeps direct access for the in-app dialog
GRANT EXECUTE ON FUNCTION public.get_public_bin_allocation_qr(uuid) TO authenticated;
