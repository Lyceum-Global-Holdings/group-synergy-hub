-- Fix NWS-VEB bin: assign correct company and re-parent to real VEB sub-location
UPDATE public.warehouse_bins
SET company_id = '1c918a89-2370-4c10-aa07-3da6e8305d7d',
    location_id = '0630cfec-e2a1-4579-8bed-a09234a0368c',
    updated_at = now()
WHERE id = 'ba8ccc12-980f-4037-8d37-b8d6fbfa9cdb';

-- Align all its allocations to the real VEB sub-location
UPDATE public.warehouse_bin_allocations
SET location_id = '0630cfec-e2a1-4579-8bed-a09234a0368c',
    updated_at = now()
WHERE bin_id = 'ba8ccc12-980f-4037-8d37-b8d6fbfa9cdb';