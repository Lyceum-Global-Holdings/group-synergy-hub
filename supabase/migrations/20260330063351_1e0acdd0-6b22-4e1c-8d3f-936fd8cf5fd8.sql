
-- 1. Fix telegram_settings: scope INSERT/UPDATE to company access + admin
DROP POLICY IF EXISTS "Authenticated users can insert telegram settings" ON public.telegram_settings;
DROP POLICY IF EXISTS "Authenticated users can update telegram settings" ON public.telegram_settings;

CREATE POLICY "Admins can insert telegram settings"
  ON public.telegram_settings FOR INSERT TO authenticated
  WITH CHECK (can_access_company(company_id) AND is_admin(auth.uid()));

CREATE POLICY "Admins can update telegram settings"
  ON public.telegram_settings FOR UPDATE TO authenticated
  USING (can_access_company(company_id) AND is_admin(auth.uid()))
  WITH CHECK (can_access_company(company_id) AND is_admin(auth.uid()));

-- 2. Fix quality_inspection_items: add SELECT policy via parent inspection
CREATE POLICY "Users can view quality inspection items"
  ON public.quality_inspection_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quality_inspections qi
      WHERE qi.id = quality_inspection_items.inspection_id
        AND can_access_company(qi.company_id)
    )
  );

-- 3. Fix floor_room_stages/materials: replace public SELECT with authenticated + company-scoped
DROP POLICY IF EXISTS "Anyone can view floor room stages" ON public.floor_room_stages;
DROP POLICY IF EXISTS "Anyone can view floor room materials" ON public.floor_room_materials;

CREATE POLICY "Authenticated users can view floor room stages"
  ON public.floor_room_stages FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view floor room materials"
  ON public.floor_room_materials FOR SELECT TO authenticated
  USING (true);

-- 4. Fix contracts: remove anon insert policy
DROP POLICY IF EXISTS "Anon can insert contracts" ON public.contracts;
