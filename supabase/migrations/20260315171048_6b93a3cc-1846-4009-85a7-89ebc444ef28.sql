
-- First deduplicate: keep the oldest bin per (bin_code, location_id), delete the rest
DELETE FROM public.warehouse_bins
WHERE id NOT IN (
  SELECT DISTINCT ON (bin_code, location_id) id
  FROM public.warehouse_bins
  ORDER BY bin_code, location_id, created_at ASC
);

-- Now add the unique constraint
ALTER TABLE public.warehouse_bins ADD CONSTRAINT warehouse_bins_bin_code_location_id_key UNIQUE (bin_code, location_id);

-- Clear company_id on all bins (bins are now shared across companies)
UPDATE public.warehouse_bins SET company_id = NULL;
