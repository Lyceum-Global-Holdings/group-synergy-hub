-- Fix RLS policies that use overly permissive USING (true) or WITH CHECK (true)
-- All these policies should require authentication at minimum

-- budget_transactions
DROP POLICY IF EXISTS "Users can create budget transactions" ON public.budget_transactions;
DROP POLICY IF EXISTS "Users can delete budget transactions" ON public.budget_transactions;

CREATE POLICY "Authenticated users can create budget transactions" 
ON public.budget_transactions FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete budget transactions" 
ON public.budget_transactions FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- construction_resources
DROP POLICY IF EXISTS "Users can create resources" ON public.construction_resources;
DROP POLICY IF EXISTS "Users can delete resources" ON public.construction_resources;
DROP POLICY IF EXISTS "Users can update resources" ON public.construction_resources;

CREATE POLICY "Authenticated users can create resources" 
ON public.construction_resources FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete resources" 
ON public.construction_resources FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update resources" 
ON public.construction_resources FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- construction_work_orders
DROP POLICY IF EXISTS "Users can delete work orders" ON public.construction_work_orders;
DROP POLICY IF EXISTS "Users can update work orders" ON public.construction_work_orders;

CREATE POLICY "Authenticated users can delete work orders" 
ON public.construction_work_orders FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update work orders" 
ON public.construction_work_orders FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- daily_site_reports
DROP POLICY IF EXISTS "Users can create daily reports" ON public.daily_site_reports;
DROP POLICY IF EXISTS "Users can delete daily reports" ON public.daily_site_reports;
DROP POLICY IF EXISTS "Users can update daily reports" ON public.daily_site_reports;

CREATE POLICY "Authenticated users can create daily reports" 
ON public.daily_site_reports FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete daily reports" 
ON public.daily_site_reports FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update daily reports" 
ON public.daily_site_reports FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- floor_room_materials
DROP POLICY IF EXISTS "Users can create room materials" ON public.floor_room_materials;
DROP POLICY IF EXISTS "Users can delete room materials" ON public.floor_room_materials;
DROP POLICY IF EXISTS "Users can update room materials" ON public.floor_room_materials;

CREATE POLICY "Authenticated users can create room materials" 
ON public.floor_room_materials FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete room materials" 
ON public.floor_room_materials FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update room materials" 
ON public.floor_room_materials FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- project_budget_items
DROP POLICY IF EXISTS "Users can create budget items" ON public.project_budget_items;
DROP POLICY IF EXISTS "Users can delete budget items" ON public.project_budget_items;
DROP POLICY IF EXISTS "Users can update budget items" ON public.project_budget_items;

CREATE POLICY "Authenticated users can create budget items" 
ON public.project_budget_items FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete budget items" 
ON public.project_budget_items FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update budget items" 
ON public.project_budget_items FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- project_warehouse_allocations
DROP POLICY IF EXISTS "Users can delete project warehouse allocations" ON public.project_warehouse_allocations;
DROP POLICY IF EXISTS "Users can insert project warehouse allocations" ON public.project_warehouse_allocations;
DROP POLICY IF EXISTS "Users can update project warehouse allocations" ON public.project_warehouse_allocations;

CREATE POLICY "Authenticated users can create project warehouse allocations" 
ON public.project_warehouse_allocations FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project warehouse allocations" 
ON public.project_warehouse_allocations FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project warehouse allocations" 
ON public.project_warehouse_allocations FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- quality_inspection_items
DROP POLICY IF EXISTS "Users can create inspection items" ON public.quality_inspection_items;
DROP POLICY IF EXISTS "Users can delete inspection items" ON public.quality_inspection_items;
DROP POLICY IF EXISTS "Users can update inspection items" ON public.quality_inspection_items;

CREATE POLICY "Authenticated users can create inspection items" 
ON public.quality_inspection_items FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete inspection items" 
ON public.quality_inspection_items FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update inspection items" 
ON public.quality_inspection_items FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- quality_inspections
DROP POLICY IF EXISTS "Users can create quality inspections" ON public.quality_inspections;
DROP POLICY IF EXISTS "Users can delete quality inspections" ON public.quality_inspections;
DROP POLICY IF EXISTS "Users can update quality inspections" ON public.quality_inspections;

CREATE POLICY "Authenticated users can create quality inspections" 
ON public.quality_inspections FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete quality inspections" 
ON public.quality_inspections FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update quality inspections" 
ON public.quality_inspections FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- safety_incidents
DROP POLICY IF EXISTS "Users can create safety incidents" ON public.safety_incidents;
DROP POLICY IF EXISTS "Users can delete safety incidents" ON public.safety_incidents;
DROP POLICY IF EXISTS "Users can update safety incidents" ON public.safety_incidents;

CREATE POLICY "Authenticated users can create safety incidents" 
ON public.safety_incidents FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete safety incidents" 
ON public.safety_incidents FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update safety incidents" 
ON public.safety_incidents FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- safety_inspections
DROP POLICY IF EXISTS "Users can create safety inspections" ON public.safety_inspections;
DROP POLICY IF EXISTS "Users can delete safety inspections" ON public.safety_inspections;
DROP POLICY IF EXISTS "Users can update safety inspections" ON public.safety_inspections;

CREATE POLICY "Authenticated users can create safety inspections" 
ON public.safety_inspections FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete safety inspections" 
ON public.safety_inspections FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update safety inspections" 
ON public.safety_inspections FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- site_report_activities
DROP POLICY IF EXISTS "Users can create report activities" ON public.site_report_activities;
DROP POLICY IF EXISTS "Users can delete report activities" ON public.site_report_activities;
DROP POLICY IF EXISTS "Users can update report activities" ON public.site_report_activities;

CREATE POLICY "Authenticated users can create report activities" 
ON public.site_report_activities FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete report activities" 
ON public.site_report_activities FOR DELETE TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update report activities" 
ON public.site_report_activities FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);

-- telegram_settings
DROP POLICY IF EXISTS "Users can insert telegram_settings" ON public.telegram_settings;
DROP POLICY IF EXISTS "Users can update telegram_settings" ON public.telegram_settings;

CREATE POLICY "Authenticated users can insert telegram_settings" 
ON public.telegram_settings FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update telegram_settings" 
ON public.telegram_settings FOR UPDATE TO authenticated 
USING (auth.uid() IS NOT NULL);