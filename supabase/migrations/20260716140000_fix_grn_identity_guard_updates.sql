-- Fix: editing a reopened GRN draft failed with "GRN line must identify an item".
--
-- The identity guard (20260716120000) fired on EVERY grn_items UPDATE. But
-- recompute_grn_totals updates every line of a GRN (line_discount_amount,
-- total_cost) whenever the header changes — and the draft-edit flow updates the
-- header BEFORE replacing the line items. Any GRN still carrying a legacy
-- blank-identity line therefore failed on save, making it impossible to open
-- the draft and remove that very line.
--
-- Validate at the point of entry instead (ISO 9001 §7.5): enforce on INSERT and
-- on UPDATEs that touch the identity columns; unrelated updates (totals
-- recompute, disposition, status stamps) pass over legacy rows untouched.

CREATE OR REPLACE FUNCTION public.grn_items_require_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Updates that don't touch identity columns are not this guard's business —
  -- otherwise legacy blank rows brick every costing recompute on their GRN.
  IF TG_OP = 'UPDATE'
     AND NEW.warehouse_item_id IS NOT DISTINCT FROM OLD.warehouse_item_id
     AND NEW.catalog_item_id  IS NOT DISTINCT FROM OLD.catalog_item_id
     AND NEW.item_name        IS NOT DISTINCT FROM OLD.item_name
     AND NEW.item_code        IS NOT DISTINCT FROM OLD.item_code THEN
    RETURN NEW;
  END IF;

  IF NEW.warehouse_item_id IS NULL
     AND NEW.catalog_item_id IS NULL
     AND COALESCE(btrim(NEW.item_name), '') = ''
     AND COALESCE(btrim(NEW.item_code), '') = '' THEN
    RAISE EXCEPTION 'GRN line must identify an item (link it to the item master or provide a name/code)'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
