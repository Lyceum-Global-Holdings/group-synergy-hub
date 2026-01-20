-- Security Hardening Migration - Phase 4 (Remaining fixes)
-- Fix supplier documents and items with unique policy names

-- Fix Supplier Documents with unique name
DROP POLICY IF EXISTS "Users can view supplier documents for their company" ON public.supplier_documents;
CREATE POLICY "Company users can view supplier documents"
ON public.supplier_documents FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.suppliers s
  WHERE s.id = supplier_id AND can_access_company(s.company_id)
));

-- Fix Supplier Items with unique name
DROP POLICY IF EXISTS "Users can view supplier items for their company" ON public.supplier_items;
DROP POLICY IF EXISTS "Users can view supplier items" ON public.supplier_items;
CREATE POLICY "Company users can view supplier items"
ON public.supplier_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.suppliers s
  WHERE s.id = supplier_id AND can_access_company(s.company_id)
));