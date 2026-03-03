-- Fix company scoping for construction Transfers + Service & Repair data
-- and add server-side safeguards to prevent future cross-company drift.

-- 0) Guardrail: detect invalid transfers with mixed-company items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.construction_transfer_items cti
    JOIN public.construction_item_master cim ON cim.id = cti.item_master_id
    GROUP BY cti.transfer_id
    HAVING COUNT(DISTINCT cim.company_id) > 1
  ) THEN
    RAISE EXCEPTION 'Found transfer(s) containing items from multiple companies. Resolve manually before migration.';
  END IF;
END $$;

-- 1) Backfill transfer company_id from transfer items -> item master (authoritative source)
WITH transfer_company AS (
  SELECT
    cti.transfer_id,
    MIN(cim.company_id::text)::uuid AS company_id
  FROM public.construction_transfer_items cti
  JOIN public.construction_item_master cim ON cim.id = cti.item_master_id
  WHERE cim.company_id IS NOT NULL
  GROUP BY cti.transfer_id
)
UPDATE public.construction_inventory_transfers t
SET company_id = tc.company_id
FROM transfer_company tc
WHERE t.id = tc.transfer_id
  AND t.company_id IS DISTINCT FROM tc.company_id;

-- 2) Backfill repair company_id from serial/item company
WITH repair_company AS (
  SELECT
    rr.id,
    COALESCE(sn.company_id, im.company_id) AS company_id
  FROM public.construction_repair_records rr
  LEFT JOIN public.construction_serial_numbers sn ON sn.id = rr.serial_number_id
  LEFT JOIN public.construction_item_master im ON im.id = rr.item_master_id
)
UPDATE public.construction_repair_records rr
SET company_id = rc.company_id
FROM repair_company rc
WHERE rr.id = rc.id
  AND rc.company_id IS NOT NULL
  AND rr.company_id IS DISTINCT FROM rc.company_id;

-- 3) Backfill transaction company_id using strongest available linkage
-- precedence: transfer -> repair -> serial -> item
WITH transaction_company AS (
  SELECT
    tx.id,
    COALESCE(tr.company_id, rr.company_id, sn.company_id, im.company_id) AS company_id
  FROM public.construction_inventory_transactions tx
  LEFT JOIN public.construction_inventory_transfers tr ON tr.id = tx.transfer_id
  LEFT JOIN public.construction_repair_records rr ON rr.id = tx.repair_id
  LEFT JOIN public.construction_serial_numbers sn ON sn.id = tx.serial_number_id
  LEFT JOIN public.construction_item_master im ON im.id = tx.item_master_id
)
UPDATE public.construction_inventory_transactions tx
SET company_id = tc.company_id
FROM transaction_company tc
WHERE tx.id = tc.id
  AND tc.company_id IS NOT NULL
  AND tx.company_id IS DISTINCT FROM tc.company_id;

-- 4) Trigger: always normalize repair company_id from related records
CREATE OR REPLACE FUNCTION public.sync_construction_repair_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.serial_number_id IS NOT NULL THEN
    SELECT company_id
    INTO NEW.company_id
    FROM public.construction_serial_numbers
    WHERE id = NEW.serial_number_id;
  END IF;

  IF NEW.company_id IS NULL AND NEW.item_master_id IS NOT NULL THEN
    SELECT company_id
    INTO NEW.company_id
    FROM public.construction_item_master
    WHERE id = NEW.item_master_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_construction_repair_company_id
ON public.construction_repair_records;

CREATE TRIGGER trg_sync_construction_repair_company_id
BEFORE INSERT OR UPDATE ON public.construction_repair_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_construction_repair_company_id();

-- 5) Trigger: keep transfer company_id aligned with transfer items' item company
CREATE OR REPLACE FUNCTION public.sync_transfer_company_from_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT cim.company_id
  INTO v_company_id
  FROM public.construction_item_master cim
  WHERE cim.id = NEW.item_master_id;

  IF v_company_id IS NOT NULL THEN
    UPDATE public.construction_inventory_transfers
    SET company_id = v_company_id
    WHERE id = NEW.transfer_id
      AND company_id IS DISTINCT FROM v_company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_transfer_company_from_items
ON public.construction_transfer_items;

CREATE TRIGGER trg_sync_transfer_company_from_items
AFTER INSERT OR UPDATE OF item_master_id ON public.construction_transfer_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_transfer_company_from_items();

-- 6) Trigger: always normalize transaction company_id from linked entities
CREATE OR REPLACE FUNCTION public.sync_construction_transaction_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.transfer_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.construction_inventory_transfers
    WHERE id = NEW.transfer_id;
  END IF;

  IF NEW.company_id IS NULL AND NEW.repair_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.construction_repair_records
    WHERE id = NEW.repair_id;
  END IF;

  IF NEW.company_id IS NULL AND NEW.serial_number_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.construction_serial_numbers
    WHERE id = NEW.serial_number_id;
  END IF;

  IF NEW.company_id IS NULL AND NEW.item_master_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.construction_item_master
    WHERE id = NEW.item_master_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_construction_transaction_company_id
ON public.construction_inventory_transactions;

CREATE TRIGGER trg_sync_construction_transaction_company_id
BEFORE INSERT OR UPDATE ON public.construction_inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_construction_transaction_company_id();