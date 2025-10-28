-- Remove finished_good_id column from bill_of_materials table
-- First drop dependent views, then remove the column, then recreate views

-- Drop dependent views
DROP VIEW IF EXISTS public.modern_boms CASCADE;

-- Remove the column
ALTER TABLE public.bill_of_materials DROP COLUMN IF EXISTS finished_good_id;

-- Recreate the view without finished_good_id
CREATE OR REPLACE VIEW public.modern_boms AS
SELECT 
  bom.id,
  bom.bom_number,
  bom.product_name,
  bom.product_master_id,
  bom.warehouse_item_id,
  bom.style_no,
  bom.version,
  bom.size,
  bom.description,
  bom.status,
  bom.po_id,
  bom.company_id,
  bom.created_by,
  bom.created_at,
  bom.updated_at,
  bom.is_legacy_bom,
  bom.size_specific,
  bom.target_sizes
FROM bill_of_materials bom;