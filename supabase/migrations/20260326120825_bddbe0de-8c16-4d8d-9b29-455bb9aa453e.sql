
-- Drop existing company-scoped policies
DROP POLICY IF EXISTS "Users can view batches in their company" ON item_batches;
DROP POLICY IF EXISTS "Users can update batches in their company" ON item_batches;
DROP POLICY IF EXISTS "Users can delete batches in their company" ON item_batches;
DROP POLICY IF EXISTS "Users can insert batches in their company" ON item_batches;

-- Create new authenticated-level policies matching warehouse_items pattern
CREATE POLICY "Users can view batches"
  ON item_batches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert batches"
  ON item_batches FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update batches"
  ON item_batches FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete batches"
  ON item_batches FOR DELETE TO authenticated USING (true);
