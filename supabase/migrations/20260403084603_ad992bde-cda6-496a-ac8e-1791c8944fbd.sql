
-- 1. TELEGRAM SETTINGS: Drop overly permissive INSERT/UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can insert telegram_settings" ON telegram_settings;
DROP POLICY IF EXISTS "Authenticated users can update telegram_settings" ON telegram_settings;

-- 2. ITEM_BATCHES: Replace unrestricted policies with company-scoped
DROP POLICY IF EXISTS "Users can view batches" ON item_batches;
DROP POLICY IF EXISTS "Users can insert batches" ON item_batches;
DROP POLICY IF EXISTS "Users can update batches" ON item_batches;
DROP POLICY IF EXISTS "Users can delete batches" ON item_batches;

CREATE POLICY "Users can view batches in their company"
  ON item_batches FOR SELECT TO authenticated
  USING (can_access_company(company_id));

CREATE POLICY "Users can insert batches in their company"
  ON item_batches FOR INSERT TO authenticated
  WITH CHECK (can_access_company(company_id));

CREATE POLICY "Users can update batches in their company"
  ON item_batches FOR UPDATE TO authenticated
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));

CREATE POLICY "Admins can delete batches in their company"
  ON item_batches FOR DELETE TO authenticated
  USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- 3. FLOOR_ROOM_STAGES & FLOOR_ROOM_MATERIALS: Fix public access
-- Both tables have company_id directly
DROP POLICY IF EXISTS "Users can view room stages" ON floor_room_stages;
DROP POLICY IF EXISTS "Users can view room materials" ON floor_room_materials;

CREATE POLICY "Authenticated users can view room stages"
  ON floor_room_stages FOR SELECT TO authenticated
  USING (can_access_company(company_id));

CREATE POLICY "Authenticated users can view room materials"
  ON floor_room_materials FOR SELECT TO authenticated
  USING (can_access_company(company_id));
