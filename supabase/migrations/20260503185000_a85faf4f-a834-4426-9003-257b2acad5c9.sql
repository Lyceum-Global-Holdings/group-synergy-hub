-- 1) rfq_rfp_items
DROP POLICY IF EXISTS "Users can view RFQ/RFP items they have access to" ON public.rfq_rfp_items;
CREATE POLICY "Users can view RFQ/RFP items they have access to"
ON public.rfq_rfp_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rfq_rfp_requests r
    WHERE r.id = rfq_rfp_items.request_id
      AND (
        is_admin((SELECT auth.uid()))
        OR r.created_by = (SELECT auth.uid())
        OR (r.company_id IS NOT NULL AND can_access_company(r.company_id))
      )
  )
);

-- 2) rfq_rfp_invited_suppliers
DROP POLICY IF EXISTS "Users can view invitations for requests they have access to" ON public.rfq_rfp_invited_suppliers;
CREATE POLICY "Users can view invitations for requests they have access to"
ON public.rfq_rfp_invited_suppliers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rfq_rfp_requests r
    WHERE r.id = rfq_rfp_invited_suppliers.request_id
      AND (
        is_admin((SELECT auth.uid()))
        OR r.created_by = (SELECT auth.uid())
        OR (r.company_id IS NOT NULL AND can_access_company(r.company_id))
      )
  )
);

-- 3) supplier_quote_items: join through quote -> request to scope by company
DROP POLICY IF EXISTS "Users can view quote items they have access to" ON public.supplier_quote_items;
CREATE POLICY "Users can view quote items they have access to"
ON public.supplier_quote_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_quotes q
    LEFT JOIN public.rfq_rfp_requests r ON r.id = q.request_id
    WHERE q.id = supplier_quote_items.quote_id
      AND (
        is_admin((SELECT auth.uid()))
        OR q.created_by = (SELECT auth.uid())
        OR r.created_by = (SELECT auth.uid())
        OR (r.company_id IS NOT NULL AND can_access_company(r.company_id))
      )
  )
);

-- 4) bom_finished_goods: fix p.id -> p.user_id
DROP POLICY IF EXISTS "Users can view bom_finished_goods for their company" ON public.bom_finished_goods;
CREATE POLICY "Users can view bom_finished_goods for their company"
ON public.bom_finished_goods
FOR SELECT
USING (
  is_admin((SELECT auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
      AND (
        bom.created_by = (SELECT auth.uid())
        OR (bom.company_id IS NOT NULL AND bom.company_id = (
          SELECT p.company_id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
        ))
      )
  )
);

DROP POLICY IF EXISTS "Users can insert bom_finished_goods for their company" ON public.bom_finished_goods;
CREATE POLICY "Users can insert bom_finished_goods for their company"
ON public.bom_finished_goods
FOR INSERT
WITH CHECK (
  is_admin((SELECT auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
      AND (
        bom.created_by = (SELECT auth.uid())
        OR (bom.company_id IS NOT NULL AND bom.company_id = (
          SELECT p.company_id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
        ))
      )
  )
);

DROP POLICY IF EXISTS "Users can delete bom_finished_goods for their company" ON public.bom_finished_goods;
CREATE POLICY "Users can delete bom_finished_goods for their company"
ON public.bom_finished_goods
FOR DELETE
USING (
  is_admin((SELECT auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
      AND (
        bom.created_by = (SELECT auth.uid())
        OR (bom.company_id IS NOT NULL AND bom.company_id = (
          SELECT p.company_id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
        ))
      )
  )
);