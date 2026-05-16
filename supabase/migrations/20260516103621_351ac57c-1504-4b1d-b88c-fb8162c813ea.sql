-- Build victim -> keeper mapping into a temp table.
CREATE TEMP TABLE bin_dedupe_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    location_id,
    lower(bin_code) AS code,
    EXISTS (SELECT 1 FROM warehouse_bin_allocations a WHERE a.bin_id = wb.id) AS has_alloc,
    company_id IS NOT NULL AS has_company,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY location_id, lower(bin_code)
      ORDER BY
        (EXISTS (SELECT 1 FROM warehouse_bin_allocations a WHERE a.bin_id = wb.id))::int DESC,
        (company_id IS NOT NULL)::int DESC,
        created_at ASC,
        id ASC
    ) AS rn
  FROM warehouse_bins wb
),
keepers AS (
  SELECT location_id, code, id AS keeper_id FROM ranked WHERE rn = 1
)
SELECT v.id AS victim_id, k.keeper_id
FROM ranked v
JOIN keepers k ON k.location_id = v.location_id AND k.code = v.code
WHERE v.rn > 1;

-- Repoint all FK references from victims to keepers.
UPDATE stock_transfer_items s SET from_bin_id = m.keeper_id
  FROM bin_dedupe_map m WHERE s.from_bin_id = m.victim_id;
UPDATE stock_transfer_items s SET to_bin_id = m.keeper_id
  FROM bin_dedupe_map m WHERE s.to_bin_id = m.victim_id;
UPDATE pick_list_items s SET bin_id = m.keeper_id
  FROM bin_dedupe_map m WHERE s.bin_id = m.victim_id;
UPDATE putaway_items s SET to_bin_id = m.keeper_id
  FROM bin_dedupe_map m WHERE s.to_bin_id = m.victim_id;
UPDATE finished_goods_issue_items s SET from_bin_id = m.keeper_id
  FROM bin_dedupe_map m WHERE s.from_bin_id = m.victim_id;
UPDATE tool_bin_allocations s SET bin_id = m.keeper_id
  FROM bin_dedupe_map m WHERE s.bin_id = m.victim_id;
UPDATE tool_issues s SET bin_id = m.keeper_id
  FROM bin_dedupe_map m WHERE s.bin_id = m.victim_id;
UPDATE stock_transactions s SET bin_id = m.keeper_id
  FROM bin_dedupe_map m WHERE s.bin_id = m.victim_id;
UPDATE warehouse_partial_pieces s SET bin_id = m.keeper_id
  FROM bin_dedupe_map m WHERE s.bin_id = m.victim_id;
-- ON DELETE CASCADE tables (warehouse_bin_allocations, batch_stock_allocations,
-- warehouse_bin_relocations) clean themselves when victim rows are deleted,
-- but victims are empty by definition (filtered by has_alloc above).

-- Delete the duplicate shells.
DELETE FROM warehouse_bins wb
USING bin_dedupe_map m
WHERE wb.id = m.victim_id;

-- Enforce uniqueness so duplicates cannot return.
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_bins_code_per_location_uidx
  ON warehouse_bins (location_id, lower(bin_code));
