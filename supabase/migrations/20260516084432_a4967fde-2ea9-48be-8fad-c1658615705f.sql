-- Re-parent NWS-VEB bin to VEB sub-location and realign allocations
UPDATE public.warehouse_bins
SET location_id = '0630cfec-e2a1-4579-8bed-a09234a0368c'
WHERE id = 'ba8ccc12-980f-4037-8d37-b8d6fbfa9cdb';

UPDATE public.warehouse_bin_allocations
SET location_id = '0630cfec-e2a1-4579-8bed-a09234a0368c'
WHERE bin_id = 'ba8ccc12-980f-4037-8d37-b8d6fbfa9cdb'
  AND location_id = 'de0c4bd9-e86d-4881-a9b0-d41c98b4573a';