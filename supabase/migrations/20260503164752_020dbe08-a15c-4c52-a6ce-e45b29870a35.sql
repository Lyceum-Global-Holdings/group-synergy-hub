WITH parsed AS (
  SELECT
    st.id AS tx_id,
    st.location_id,
    trim(substring(st.notes FROM 'Bin:\s*([A-Za-z0-9_\-\.]+)')) AS bin_code
  FROM public.stock_transactions st
  WHERE st.bin_id IS NULL
    AND st.notes ~* 'Bin:\s*'
), resolved AS (
  SELECT p.tx_id, MIN(b.id::text)::uuid AS bin_id
  FROM parsed p
  JOIN public.warehouse_bins b
    ON b.bin_code = p.bin_code
   AND (p.location_id IS NULL OR b.location_id = p.location_id)
  GROUP BY p.tx_id
  HAVING COUNT(*) = 1
)
UPDATE public.stock_transactions st
SET bin_id = r.bin_id
FROM resolved r
WHERE st.id = r.tx_id;