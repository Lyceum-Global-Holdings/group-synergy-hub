-- Fix modern_boms view security definer issue
-- Recreate view with SECURITY INVOKER to use querying user's permissions
DROP VIEW IF EXISTS public.modern_boms CASCADE;

CREATE OR REPLACE VIEW public.modern_boms
WITH (security_invoker = true)
AS
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