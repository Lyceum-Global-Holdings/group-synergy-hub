
WITH need AS (
  SELECT DISTINCT st.location_id, wl.company_id
  FROM stock_transactions st
  JOIN warehouse_locations wl ON wl.id = st.location_id
  WHERE st.bin_id IS NULL AND st.location_id IS NOT NULL
)
INSERT INTO warehouse_bins (id, bin_code, name, location_id, company_id, created_at, updated_at)
SELECT gen_random_uuid(), 'SYS-LEGACY', 'System Legacy Bin', n.location_id, n.company_id, now(), now()
FROM need n
WHERE NOT EXISTS (
  SELECT 1 FROM warehouse_bins wb
  WHERE wb.location_id = n.location_id AND wb.bin_code = 'SYS-LEGACY'
);

UPDATE stock_transactions st
SET bin_id = wb.id
FROM warehouse_bins wb
WHERE st.bin_id IS NULL
  AND st.location_id IS NOT NULL
  AND wb.location_id = st.location_id
  AND wb.bin_code = 'SYS-LEGACY';

DO $$
DECLARE
  r RECORD; v_loc uuid; v_bin uuid; v_code text;
BEGIN
  FOR r IN
    SELECT DISTINCT company_id FROM stock_transactions
    WHERE bin_id IS NULL AND location_id IS NULL AND company_id IS NOT NULL
  LOOP
    SELECT id INTO v_loc FROM warehouse_locations
      WHERE company_id = r.company_id AND name = 'SYS-LEGACY' LIMIT 1;
    IF v_loc IS NULL THEN
      v_code := 'SYS-LEGACY-' || substring(r.company_id::text, 1, 8);
      INSERT INTO warehouse_locations (id, name, company_id, location_code, created_at, updated_at)
      VALUES (gen_random_uuid(), 'SYS-LEGACY', r.company_id, v_code, now(), now())
      RETURNING id INTO v_loc;
    END IF;
    SELECT id INTO v_bin FROM warehouse_bins
      WHERE location_id = v_loc AND bin_code = 'SYS-LEGACY' LIMIT 1;
    IF v_bin IS NULL THEN
      INSERT INTO warehouse_bins (id, bin_code, name, location_id, company_id, created_at, updated_at)
      VALUES (gen_random_uuid(), 'SYS-LEGACY', 'System Legacy Bin', v_loc, r.company_id, now(), now())
      RETURNING id INTO v_bin;
    END IF;
    UPDATE stock_transactions
      SET location_id = v_loc, bin_id = v_bin
      WHERE bin_id IS NULL AND location_id IS NULL AND company_id = r.company_id;
  END LOOP;
END $$;

INSERT INTO warehouse_bin_allocations
  (id, warehouse_item_id, bin_id, company_id, location_id,
   allocated_quantity, reserved_quantity, created_at, updated_at)
SELECT gen_random_uuid(), st.item_id, st.bin_id, COALESCE(st.company_id, wb.company_id), wb.location_id,
       0, 0, now(), now()
FROM (
  SELECT DISTINCT item_id, bin_id, company_id FROM stock_transactions
  WHERE bin_id IS NOT NULL AND item_id IS NOT NULL
) st
JOIN warehouse_bins wb ON wb.id = st.bin_id
WHERE wb.company_id IS NOT NULL AND wb.location_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM warehouse_bin_allocations wba
    WHERE wba.warehouse_item_id = st.item_id AND wba.bin_id = st.bin_id
  );

-- Recompute SYS-LEGACY allocated_quantity from ledger
UPDATE warehouse_bin_allocations wba
SET allocated_quantity = GREATEST(0, (
      SELECT COALESCE(SUM(quantity_change), 0)
      FROM stock_transactions st
      WHERE st.item_id = wba.warehouse_item_id AND st.bin_id = wba.bin_id
    )),
    updated_at = now()
WHERE wba.bin_id IN (SELECT id FROM warehouse_bins WHERE bin_code = 'SYS-LEGACY');

DO $$
DECLARE
  r RECORD; v_bin uuid;
BEGIN
  FOR r IN
    SELECT wi.id AS item_id, wi.company_id, wi.location_id, wi.current_stock
    FROM warehouse_items wi
    WHERE COALESCE(wi.current_stock,0) > 0
      AND wi.location_id IS NOT NULL AND wi.company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM warehouse_bin_allocations wba
        WHERE wba.warehouse_item_id = wi.id AND wba.allocated_quantity > 0
      )
  LOOP
    SELECT id INTO v_bin FROM warehouse_bins
      WHERE location_id = r.location_id AND bin_code = 'SYS-LEGACY' LIMIT 1;
    IF v_bin IS NULL THEN
      INSERT INTO warehouse_bins (id, bin_code, name, location_id, company_id, created_at, updated_at)
      VALUES (gen_random_uuid(), 'SYS-LEGACY', 'System Legacy Bin', r.location_id, r.company_id, now(), now())
      RETURNING id INTO v_bin;
    END IF;
    INSERT INTO warehouse_bin_allocations
      (id, warehouse_item_id, bin_id, company_id, location_id,
       allocated_quantity, reserved_quantity, created_at, updated_at)
    VALUES (gen_random_uuid(), r.item_id, v_bin, r.company_id, r.location_id,
            r.current_stock, 0, now(), now())
    ON CONFLICT (warehouse_item_id, bin_id) DO UPDATE
      SET allocated_quantity = GREATEST(warehouse_bin_allocations.allocated_quantity, EXCLUDED.allocated_quantity),
          updated_at = now();
  END LOOP;
END $$;

UPDATE warehouse_bin_allocations wba
SET company_id = COALESCE(wba.company_id, wb.company_id),
    location_id = COALESCE(wba.location_id, wb.location_id)
FROM warehouse_bins wb
WHERE wb.id = wba.bin_id AND (wba.company_id IS NULL OR wba.location_id IS NULL);

ALTER TABLE warehouse_bin_allocations
  ALTER COLUMN company_id SET NOT NULL,
  ALTER COLUMN location_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_bin_allocation_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bin_company uuid;
  v_bin_location uuid;
BEGIN
  IF NEW.bin_id IS NULL OR NEW.item_id IS NULL THEN RETURN NEW; END IF;
  SELECT company_id, location_id INTO v_bin_company, v_bin_location
    FROM warehouse_bins WHERE id = NEW.bin_id;
  IF v_bin_company IS NULL OR v_bin_location IS NULL THEN RETURN NEW; END IF;
  INSERT INTO warehouse_bin_allocations
    (id, warehouse_item_id, bin_id, company_id, location_id,
     allocated_quantity, reserved_quantity, created_at, updated_at)
  VALUES (gen_random_uuid(), NEW.item_id, NEW.bin_id,
          v_bin_company, v_bin_location, 0, 0, now(), now())
  ON CONFLICT (warehouse_item_id, bin_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_bin_allocation_exists ON stock_transactions;
CREATE TRIGGER trg_ensure_bin_allocation_exists
AFTER INSERT ON stock_transactions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_bin_allocation_exists();

DROP POLICY IF EXISTS "Admins can delete bin allocations" ON warehouse_bin_allocations;
DROP POLICY IF EXISTS "Company users can create bin allocations" ON warehouse_bin_allocations;
DROP POLICY IF EXISTS "Company users can update bin allocations" ON warehouse_bin_allocations;
DROP POLICY IF EXISTS "Company users can view bin allocations" ON warehouse_bin_allocations;

CREATE POLICY "Company users can view bin allocations"
  ON warehouse_bin_allocations FOR SELECT TO authenticated
  USING (can_access_company(company_id));
CREATE POLICY "Company users can create bin allocations"
  ON warehouse_bin_allocations FOR INSERT TO authenticated
  WITH CHECK (can_access_company(company_id));
CREATE POLICY "Company users can update bin allocations"
  ON warehouse_bin_allocations FOR UPDATE TO authenticated
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));
CREATE POLICY "Admins can delete bin allocations"
  ON warehouse_bin_allocations FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) AND can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view stock transactions" ON stock_transactions;
CREATE POLICY "Company users can view stock transactions"
  ON stock_transactions FOR SELECT TO authenticated
  USING (company_id IS NULL OR can_access_company(company_id));
