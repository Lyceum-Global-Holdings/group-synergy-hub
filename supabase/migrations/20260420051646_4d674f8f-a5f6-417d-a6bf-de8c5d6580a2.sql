-- Remove overly permissive policy
DROP POLICY IF EXISTS "Users can manage daily entries" ON public.production_daily_entries;

-- Ensure RLS is enabled
ALTER TABLE public.production_daily_entries ENABLE ROW LEVEL SECURITY;

-- Company-scoped SELECT
CREATE POLICY "Select daily entries by company"
ON public.production_daily_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.production_order_stages pos
    JOIN public.production_orders po ON po.id = pos.order_id
    WHERE pos.id = production_daily_entries.stage_id
      AND public.can_access_company(po.company_id)
  )
);

-- Company-scoped INSERT
CREATE POLICY "Insert daily entries by company"
ON public.production_daily_entries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.production_order_stages pos
    JOIN public.production_orders po ON po.id = pos.order_id
    WHERE pos.id = production_daily_entries.stage_id
      AND public.can_access_company(po.company_id)
  )
);

-- Company-scoped UPDATE
CREATE POLICY "Update daily entries by company"
ON public.production_daily_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.production_order_stages pos
    JOIN public.production_orders po ON po.id = pos.order_id
    WHERE pos.id = production_daily_entries.stage_id
      AND public.can_access_company(po.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.production_order_stages pos
    JOIN public.production_orders po ON po.id = pos.order_id
    WHERE pos.id = production_daily_entries.stage_id
      AND public.can_access_company(po.company_id)
  )
);

-- Company-scoped DELETE
CREATE POLICY "Delete daily entries by company"
ON public.production_daily_entries
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.production_order_stages pos
    JOIN public.production_orders po ON po.id = pos.order_id
    WHERE pos.id = production_daily_entries.stage_id
      AND public.can_access_company(po.company_id)
  )
);