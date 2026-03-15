DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_bins_bin_code_company_id_key'
  ) THEN
    ALTER TABLE public.warehouse_bins DROP CONSTRAINT warehouse_bins_bin_code_company_id_key;
  END IF;
END $$;